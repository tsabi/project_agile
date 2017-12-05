# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class Project(models.Model):
    _inherit = 'project.project'

    agile_method = fields.Selection(
        selection_add=[('kanban', 'Kanban')],
        default='kanban',
    )

    @api.multi
    def agile_kanban_enabled(self):
        self.ensure_one()
        return self.agile_enabled and self.agile_method == 'kanban'


class Board(models.Model):
    _inherit = 'project.agile.board'

    type = fields.Selection(
        selection_add=[('kanban', 'Kanban')],
    )
