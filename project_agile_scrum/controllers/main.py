# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import logging
from odoo import http, fields, exceptions, _
from odoo.http import request
from odoo.addons.project_agile.controllers.main import AgileController

_logger = logging.getLogger(__name__)


class ScrumController(AgileController):
    @http.route('/agile/web/data/sprint/<model("project.agile.scrum.sprint"):sprint>/start', type='json', auth='user')
    def sprint_start(self, sprint, start_date, end_date):
        sprint.write({
            'state': 'active',
            'start_date': start_date,
            'end_date': end_date
        })

        return {
            'state': 'active',
            'start_date': sprint.start_date,
            'end_date': sprint.end_date,
        }

    @http.route('/agile/web/data/sprint/<model("project.agile.scrum.sprint"):sprint>/stop', type='json', auth='user')
    def sprint_stop(self, sprint):
        # Mark sprint as done
        sprint.write({'state': 'completed', 'actual_end_date': fields.Datetime.now()})

        # Remove unfinished tasks from the sprint
        sprint.task_ids.filtered(lambda t: t.wkf_state_type != "done").write({"sprint_id": False})

        return {
            'state': sprint.state,
            'actual_end_date': sprint.actual_end_date,
        }

    @http.route('/agile/web/data/sprint/create', type='json', auth='user')
    def sprint_create(self, sprint):
        env = request.env()

        team = env.user.team_id
        if team:
            sprint['team_id'] = team.id
        else:
            raise exceptions.ValidationError(_("You have to be part of an agile team in order to create new sprint"))

        sprint = env['project.agile.scrum.sprint'].create(sprint)
        data = sprint.read()[0]

        return data

    @http.route('/agile/web/data/active_sprints/<model("project.agile.board"):board>', type='json', auth='user')
    def active_sprints(self, board, **options):
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
                "projects": {},
            },
            "workflow": self.prepare_workflow(board.workflow_id),
            "active_sprints": {},
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
        for sprint in request.env.user.team_id.sprint_ids:
            if sprint.state == "active" and sprint.id not in result['active_sprints']:
                result['active_sprints'][sprint.id] = self.prepare_active_sprint(sprint)
                for task in sprint.task_ids:
                    if task.stage_id.id in stages_in_board and (
                                    not project_id and task.project_id.id in board.project_ids.ids or project_id and project_id == task.project_id.id):
                        tasks.add(task.id)
                        if task.user_id.id not in result['users']:
                            result['users'][task.user_id.id] = self.prepare_user(task.user_id)
                            # if task.parent_id and (not project_id and task.parent_id.project_id.id in board.project_ids.ids or
                            #                                project_id and project_id == task.parent_id.project_id.id):
                            #     tasks.add(task.parent_id.id)
                            #     if task.parent_id.user_id.id not in result['users']:
                            #         result['users'][task.parent_id.user_id.id] = self.prepare_user(task.parent_id.user_id)
        result['ids'] = list(tasks)
        return result

    def prepare_task(self, task):
        task_data = super(ScrumController, self).prepare_task(task)
        task_data.update({
            'sprint_id': task.sprint_id.id,
        })
        return task_data

    def prepare_active_sprint(self, sprint):
        return {
            'id': sprint.id,
            'name': sprint.name,
        }

    def get_security_models(self):
        result = super(ScrumController, self).get_security_models()
        result.append("project.agile.scrum.sprint")
        return result

    def prepare_user_team(self, team):
        result = super(ScrumController, self).prepare_user_team(team)
        result["sprint_ids"] = team.sprint_ids.filtered(lambda x: x.state != "completed").ids
        return result
