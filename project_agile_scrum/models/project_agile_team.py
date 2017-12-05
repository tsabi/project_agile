# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api, tools, exceptions, _
from odoo.addons.project_agile import xmlid_to_action


class ScrumTeam(models.Model):
    _inherit = 'project.agile.team'

    master_id = fields.Many2one(
        comodel_name='res.users',
        string='Scrum Master'
    )

    sprint_ids = fields.One2many(
        comodel_name='project.agile.scrum.sprint',
        inverse_name='team_id',
        string='Sprints',
        readonly=True,
    )

    velocity = fields.Integer(
        string='Velocity',
    )

    active_sprint_id = fields.Many2one(
        comodel_name='project.agile.scrum.sprint',
        string='Active Sprint',
        compute="_compute_active_sprint",
    )

    sprint_sequence = fields.Integer(
        string='Sprint Sequence',
        default=1
    )

    @api.multi
    @api.depends("sprint_ids", "sprint_ids.state")
    def _compute_active_sprint_count(self):
        for record in self:
            record.active_sprint_count = len(record.sprint_ids.filtered(lambda r: r.state == 'active'))

    active_sprint_count = fields.Integer(
        string="Active Sprint Count",
        compute=_compute_active_sprint_count,
    )

    @api.multi
    @api.depends("sprint_ids", "sprint_ids.state")
    def _compute_future_sprint_count(self):
        for record in self:
            record.future_sprint_count = len(record.sprint_ids.filtered(lambda r: r.state == 'draft'))

    future_sprint_count = fields.Integer(
        string="Future Sprint Count",
        compute=_compute_future_sprint_count,
    )

    @api.multi
    @api.depends("sprint_ids", "sprint_ids.state")
    def _compute_completed_sprint_count(self):
        for record in self:
            record.completed_sprint_count = len(record.sprint_ids.filtered(lambda r: r.state == 'completed'))

    completed_sprint_count = fields.Integer(
        string="Future Sprint Count",
        compute=_compute_completed_sprint_count,
    )

    @api.multi
    @api.depends('sprint_ids', 'sprint_ids.state')
    def _compute_active_sprint(self):
        for rec in self:
            rec.active_sprint_id = rec.sprint_ids.filtered(lambda r: r.state == 'active').id or False

    default_sprint_length = fields.Selection(
        selection=[
            ('1', 'One Week'),
            ('2', 'Two Weeks'),
            ('3', 'Tree Weeks'),
            ('4', 'Four Weeks'),
        ],
        string='Default sprint length',
        default='2',
        help="Default Sprint time for this project"
    )

    def my_team_members_domain(self):
        return ['|', ("member_ids", "in", self._uid), ("master_id", "=", self._uid)]

    @api.multi
    def open_active_sprint(self):
        return self.active_sprint_id.get_formview_action()

    @api.multi
    def open_future_sprints(self):
        action = xmlid_to_action(self, "project_agile_scrum.open_agile_sprint")
        action['name'] = _("Future Sprints")
        ctx = eval(action.get('context', "{}"))
        ctx['search_default_draft'] = 1
        action['context'] = ctx
        return action

    @api.multi
    def open_completed_sprints(self):
        action = xmlid_to_action(self, "project_agile_scrum.open_agile_sprint")
        action['name'] = _("Completed Sprints")
        ctx = eval(action.get('context', "{}"))
        ctx['search_default_completed'] = 1
        action['context'] = ctx
        return action

    @api.multi
    def open_agile(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'target': 'self',
            'url': "/agile/web"
        }


