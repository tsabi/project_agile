# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api


class Project(models.Model):
    _inherit = 'project.project'

    analytic_line_ids = fields.One2many(
        comodel_name='project.agile.analytic.line',
        inverse_name='project_id',
        string='Analytic Lines'
    )

    analytic_line_count = fields.Integer(
        string='Analytic Line Count',
        compute="_compute_analytic_line_count"
    )

    @api.multi
    def _compute_analytic_line_count(self):
        for record in self:
            record.analytic_line_count = len(record.analytic_line_ids)