# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api
from ..tools import xmlid_to_action


class BoardCreateWizard(models.TransientModel):
    _name = 'project.agile.board.create.wizard'

    name = fields.Char(
        string='Name',
        required=True
    )

    type = fields.Selection(
        selection=[('scrum', 'Scrum'), ('kanban', 'Kanban')],
        string='Type',
        default='scrum',
        required=True
    )

    workflow_id = fields.Many2one(
        comodel_name='project.workflow',
        string='Workflow',
        required=True,
    )

    project_ids = fields.Many2many(
        comodel_name='project.project',
        string='Projects',
        column1='wizard_id',
        column2='project_id',
    )

    @api.multi
    def button_apply(self):
        self.ensure_one()

        board = self.env['project.agile.board'].create(self._prepare_agile_board())

        columns = []
        order = 1
        for type in [('todo', 'To Do'), ('in_progress', 'In Progress'), ('done', 'Done')]:
            column = self._prepare_agile_board_column(type, order)
            columns.append((0, False, column))
            order += 1

        board.write({'column_ids': columns})

        if board.type == 'kanban':
            for column in board.column_ids:
                if column.name == 'To Do':
                    board.write({'default_kanban_state_id': column.status_ids.id})

        action = xmlid_to_action(self, "project_agile.open_agile_board_form")
        action['res_id'] = board.id
        return action

    def _prepare_agile_board_column(self, type, order):
        return {
            'name': type[1],
            'order': order,
            'status_ids': [(0, False, self._prepare_agile_board_state(x)) for x in self.workflow_id.state_ids if x.type == type[0]],
        }

    def _prepare_agile_board(self):
        return {
            'name': self.name,
            'type': self.type,
            'workflow_id': self.workflow_id.id,
            'project_ids': [(6, 0, self.project_ids.ids)],
        }

    def _prepare_agile_board_state(self, state):
        return {
            'name': state.name,
            'state_id': state.id,
        }