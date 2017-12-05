# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import controllers
import models
import os
from odoo.tools import misc
from odoo import api, SUPERUSER_ID


def _post_init_hook(cr, registry):
    _load_board(cr, registry)


def _load_board(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})

    board_pathname = os.path.join('project_agile_kanban', 'data', 'board.xml')
    with misc.file_open(board_pathname) as stream:
        importer = env['project_agile.board.importer']
        reader = env['project_agile.board.xml.reader']
        importer.run(reader, stream)
