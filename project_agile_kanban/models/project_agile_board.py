# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields


class ProjectAgileBoard(models.Model):
    _inherit = 'project.agile.board'

    type = fields.Selection(
        selection_add=[('kanban', 'Kanban')],
    )

    default_kanban_status_id = fields.Many2one(
        comodel_name="project.agile.board.column.status",
        string="Default kanban status",
        help="You can choose from one of the statuses mapped to columns",
        agile=True,
    )

    default_kanban_stage_id = fields.Many2one(
        comodel_name="project.task.type",
        string="Default kanban stage",
        related="default_kanban_status_id.stage_id",
        agile=True,
    )
