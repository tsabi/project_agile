# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import logging
from odoo import http
from odoo.addons.project_agile.controllers.main import AgileController

_logger = logging.getLogger(__name__)


class KanbanController(AgileController):

    @http.route('/agile/web/data/kanban_board/<model("project.agile.board"):board>', type='json', auth='user')
    def kanban_board(self, board, **options):

        # check if board exists
        if not board.exists():
            return False

        project_id = False
        if "project_id" in options and options["project_id"]:
            project_id = options["project_id"]
            pass
        tasks = set()
        result = {
            "board": {
                "name": board.name,
                "default_kanban_status": {
                    "id": board.default_kanban_status_id.id,
                    "name": board.default_kanban_status_id.name,
                },
                "projects": {},
            },
            "workflow": self.prepare_workflow(board.workflow_id),
            "users": {},
        }

        # Find all columns and their statuses in this board
        stages_in_board = set()
        result['board']['columns'] = {}
        result['board']['status'] = {}
        for column in board.column_ids:
            result['board']['columns'][column.id] = self.prepare_column(column)
            for status in column.status_ids:
                result['board']['status'][status.id] = self.prepare_status(status, column)
                stages_in_board.add(status.stage_id.id)

        for project in board.project_ids:
            if not project_id or project_id and project_id == project.id:
                result['board']['projects'][project.id] = self.prepare_project(project)

        tasks_in_board_ids = http.request.env['project.task'].search([
            ("project_id", "in", board.project_ids.ids),
            ("stage_id", "in", map(lambda x: x.stage_id.id, board.status_ids)),
        ])
        result['ids'] = tasks_in_board_ids.ids

        return result

