# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import logging
from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class Project(models.Model):
    _inherit = 'project.project'

    agile_method = fields.Selection(
        selection_add=[('scrum', 'Scrum')],
        default='scrum',
    )

    @api.multi
    def agile_scrum_enabled(self):
        self.ensure_one()
        return self.agile_enabled and self.agile_method == 'kanban'


class Task(models.Model):
    _inherit = 'project.task'

    @api.multi
    @api.depends('sprint_id', 'sprint_id.state')
    def _get_sprint_state(self):
        for record in self:
            record.sprint_state = record.sprint_id.state
        return True

    sprint_id = fields.Many2one(
        comodel_name="project.agile.scrum.sprint",
        string="Current sprint",
        domain="[('team_id','=',team_id)]",
        agile=True
    )

    sprint_ids = fields.Many2many(
        comodel_name="project.agile.scrum.sprint",
        column1="task_id",
        column2="sprint_id",
        string="Sprint history",
        agile=True
    )

    sprint_state = fields.Char(compute=_get_sprint_state, store=True)

    @api.multi
    def set_sprint(self, sprint_id):
        _logger.debug("Setting sprint ", (sprint_id,))
        self.write({'sprint_id': sprint_id})
        return True

    @api.model
    @api.returns('self', lambda value: value.id)
    def create(self, vals):
        new = super(Task, self).create(vals)
        if new.parent_id and new.parent_id.sprint_id:
            new.set_sprint(new.parent_id.sprint_id.id)
        return new

    @api.multi
    def write(self, vals):
        ret = super(Task, self).write(vals)

        if 'sprint_id' in vals:
            for record in self:
                if record.child_ids:
                    record.child_ids.write({'sprint_id': vals['sprint_id']})

        return ret


