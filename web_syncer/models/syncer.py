# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api, exceptions, _


class WebSyncer(models.AbstractModel):
    _name = "web.syncer"
    _description = "Web Syncer"

    # Following attributes are here so that we can accumulate changes of computed fields,
    # because those fields trigger write function multiple times
    _implements_syncer = True

    # If this field is True, then syncer notification would contain entire record,
    # by default it will return vals
    _sync_entire = False

    @api.multi
    def _write(self, vals):
        syncer_self = False

        # First time the write is called, we need to copy vals
        if "syncer_data" not in self._context or self._context['syncer_data']['counter'] == 0:
            ctx = self._context.copy()
            vals = vals.copy()
            syncer_data = {"vals": vals, "counter": 0}
            ctx.update({"syncer_data": syncer_data})
            syncer_self = self.with_context(ctx)

        final_self = syncer_self or self
        final_self._context['syncer_data']['counter'] += 1

        ret = super(WebSyncer, final_self)._write(vals)

        final_self._context['syncer_data']['counter'] -= 1
        if final_self._context['syncer_data']['counter'] == 0:
            if final_self._sync_entire:
                final_self.syncer_notify("write", final_self.read()[0], final_self)
            else:
                new_vals = self.prepare_vals(final_self, final_self._context['syncer_data']['vals'])
                final_self.syncer_notify("write", new_vals, final_self)
        else:
            final_self._context['syncer_data']['vals'].update(vals)
        return ret

    @api.model
    def _create(self, vals):
        record = self.browse(super(WebSyncer, self)._create(vals))
        if self._sync_entire:
            self.syncer_notify("create", record.read()[0], [record])
        else:
            self.syncer_notify("create", self.prepare_vals(record, vals), [record])
        return record.id

    # TODO: Unlink notification should be called only if we are sure that record is indeed deleted.
    # TODO: This way it is possible that some unlink override prevent unlink after notification is sent.
    @api.multi
    def unlink(self):
        self.syncer_notify("unlink", self.ids, self)
        return super(WebSyncer, self).unlink()

    def prepare_vals(self, record, vals):
        if len(record) == 0:
            raise exceptions.ValidationError("Write must be called on recordset with at least one record")
        single_record = record if len(record) == 1 else record[0]
        ret_val = vals.copy()
        for m2o in filter(lambda field: type(self._fields[field]) == fields.Many2one, ret_val.keys()):
            ret_val[m2o] = [single_record[m2o].id, single_record[m2o].name] if single_record[m2o] else False
        return ret_val

    def syncer_notify(self, method_name, data, record):
        notifications = []
        for rec in record:
            notifications.append([rec.generate_channel_name(),
                                  rec.prepare_sync_message({
                                      "method": method_name,
                                      "record_name": rec.name,
                                      "user_id": rec.prepare_user(),
                                      "__last_update": rec.write_date,
                                      "entire": self._sync_entire,
                                      "data": data
                                  })])

        return self.env['bus.bus'].sendmany(notifications)

    def generate_channel_name(self):
        return self._cr.dbname + ":" + self._name

    def prepare_user(self):
        user = self.env.user if 'uid' not in self._context or self.env.user.id == self._context['uid'] \
                             else self.env['res.users'].browse(self._context['uid'])
        return {
            "id": user.id,
            "name": user.name,
            "__last_update": user.write_date,
        }

    def prepare_sync_message(self, message):
        return [(self._cr.dbname, self._name, self.id), message]


class Bus(models.Model):
    _inherit = "bus.bus"

    def is_from_syncer(self, notification):
        if 'message' not in notification or \
                not type(notification['message']) == list or \
                not type(notification['message'][0]) == list:
            return False
        model = notification['message'][0][1]
        if model not in self.env or "syncer_notify" not in dir(self.env[model]):
            return False
        return True

    @api.model
    def poll(self, channels, last=0, options=None, force_status=False):
        result = super(Bus, self).poll(channels, last, options, force_status)
        final_result = []
        grouped = dict()
        for m in result:
            if self.is_from_syncer(m):
                key = str(m['message'][0])
                id = m['message'][0][2]
                message = m['message'][1]
                if key in grouped:
                    grouped[key]['message'][1]['data'].update(message['data'])
                    # Write has lower priority then create and unlink,
                    # so if there is create method, writes are probably due to computed fields.
                    if grouped[key]['message'][1]['method'] == 'write':
                        grouped[key]['message'][1]['method'] = message['method']
                    if grouped[key]['id'] < m['id']:
                        grouped[key]['id'] = m['id']
                else:
                    grouped[key] = m
            else:
                final_result.append(m)
        nots = grouped.values()
        for notification in nots:
            if notification['message'][1]['method'] == "unlink":
                continue
            model = notification['message'][0][1]
            data = notification['message'][1]['data']
            model_obj = self.env[model]
            m2m_fields = filter(
                lambda field_name: type(model_obj._fields[field_name]) in (fields.One2many, fields.Many2many),
                data.keys()
            )
            if len(m2m_fields) > 0:
                record = model_obj.browse(id).read()[0]
                for field_name in m2m_fields:
                    data[field_name] = record[field_name]
        return final_result + nots
