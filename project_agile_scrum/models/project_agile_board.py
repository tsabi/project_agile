# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields


class Board(models.Model):
    _inherit = 'project.agile.board'

    type = fields.Selection(
        selection_add=[('scrum', 'Scrum')],
    )
