# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import werkzeug
import logging
from odoo import http
from odoo.http import request
import json

_logger = logging.getLogger(__name__)


class AgileController(http.Controller):
    @http.route('/agile/web/data/task/create_link', type='json', auth='user')
    def create_link(self, link):
        link = request.env()['project.task.link'].create(link)
        return self.prepare_task_link(link)

    # Hotfix id: e615f5d1-c9df-41a7-85a8-4621fce94ca7
    @http.route('/agile/web/data/task/create_subitem', type='json', auth='user')
    def task_create(self, task):
        TaskModel = request.env()['project.task']
        parent_item = TaskModel.browse(task['parent_id'])
        del task['parent_id']
        subitem = TaskModel.create(task)
        parent_item.write({"child_ids": [(4, subitem.id, False)]})
        return subitem.read()[0]

    @http.route('/agile/web/data/task/<model("project.task"):task>/create_worklog', type='json', auth='user')
    def create_worklog(self, task, worklog):
        worklog['project_id'] = task.project_id.id
        worklog['account_id'] = task.project_id.analytic_account_id.id
        # Hotfix id: e615f5d1-c9df-41a7-85a8-4621fce94ca7
        worklog['is_timesheet'] = True
        del worklog['task_id']
        worklog_record = request.env()['account.analytic.line'].create(worklog)
        task.write({"timesheet_ids": [(4, worklog_record.id, False)]})
        return worklog_record.read()[0]

    @http.route('/agile/web/data/task/<model("project.task"):task>/update_worklog/<model("account.analytic.line"):worklog>', type='json', auth='user')
    def update_worklog(self, task, worklog, worklogData):
        worklog.write(worklogData)
        return worklog.read()

    @http.route('/agile/web/data/task/<model("project.task"):task>/add_comment', type='json', auth='user')
    def add_comment(self, task, comment):
        new_message = task.message_post(body=comment['body'], message_type='comment')
        return new_message.read()

    @http.route('/agile/web/data/task/<model("project.task"):task>/update_comment/<model("mail.message"):message>', type='json', auth='user')
    def edit_comment(self, task, message, comment):
        message.write(comment)
        return message.read()

    @http.route('/agile/web/data/workflow/<model("project.workflow"):workflow>', type='json', auth='user')
    def get_workflow(self, workflow):
        return self.prepare_workflow(workflow)

    @http.route('/agile/web', type='http', auth='user')
    def index(self, debug=False, **k):
        context = {
            'session_info': json.dumps(request.env['ir.http'].session_info())
        }

        return request.render('project_agile.index', qcontext=context)

    @http.route('/agile/web/data/task/<model("project.task"):task>/confirm_stage_change', type='json', auth='user')
    def confirm_task_stage_change(self, task, stage_id=None, message=None):
        msg = task._confirm_stage_change(None, stage_id, message)
        return msg and msg.read()[0] or False

    @http.route('/agile/web/data/task/<model("project.task"):task>/get_task_links', type='json', auth='user')
    def get_task_links(self, task):
        return [self.prepare_task_link(link) for link in task.link_ids]

    @http.route('/agile/web/data/project/<model("project.project"):project>/task_types_and_priorities', type='json', auth='user')
    def task_types_and_priorities(self, project):
        result = {
            'types': {},
            'priorities': {},
        }

        # Recursively prepare all project types and subtypes
        def collect_task_types(type):
            if type.id in result['types']: return

            result['types'][type.id] = self.prepare_task_type(type)
            for subtype in type.type_ids:
                collect_task_types(subtype)

        for type in project.type_id.task_type_ids:
            collect_task_types(type)
            for priority in type.priority_ids:
                result['priorities'][priority.id] = self.prepare_task_priority(priority)
        # Keep track of task types that belong directly to project

        result["project_types"] = project.type_id.task_type_ids.ids
        return result

    def prepare_message_subtype(self, subtype):
        return {
            'id': subtype.id,
            'name': subtype.name,
            'sequence': subtype.sequence,
            'default': subtype.default
        }

    def prepare_activity_message_(self, message):
        activity_message = {
            'id': message.id,
            'body': message.body,
            'record_name': message.record_name,
            'date': message.date,
            'transitions': {},
            'author': {
                'name': message.author_id and message.author_id.name or message.email_from,
                'id': message.author_id and message.author_id.id or False,
                'write_date': message.author_id and message.author_id.write_date or 0
            },
            'tracking_value_ids': [{
                'id': t.id,
                'field_desc': t.field_desc,
                'new_value': t.new_value_char,
                'old_value': t.old_value_char,
            } for t in message.tracking_value_ids]
        }
        return activity_message

    def prepare_task_link(self, link):
        result = {
            "id": link.id,
            # "task_id": link.task_id,
            "related_task": self.prepare_task(link.related_task_id),
            "relation_name": link.relation_name
        }
        user_id = link.related_task_id.user_id
        result["related_task"]["user_id"] = user_id.id and [user_id.id, user_id.name] or False
        return result

    def prepare_task_type(self, type):
        return {
            'id': type.id,
            'name': type.name,
            'allow_sub_tasks': type.allow_sub_tasks,
            'type_ids': type.type_ids.ids,
            'agile_icon': type.agile_icon,
            'agile_icon_color': type.agile_icon_color,
            'priority_ids': [p.id for p in type.priority_ids],
            'default_priority_id': type.default_priority_id.id,
            'allow_story_points': type.allow_story_points,
        }

    def prepare_task_priority(self, priority):
        return {
            'id': priority.id,
            'name': priority.name,
            'agile_icon': priority.agile_icon,
            'agile_icon_color': priority.agile_icon_color,
        }

    def prepare_board(self, board):
        return {
            'id': board.id,
            'name': board.name,
        }

    def prepare_task(self, task):
        return {
            'id': task.id,
            'name': task.name,
            'key': task.key,
            'description': task.description,
            'agile_order': task.agile_order,
            'type_agile_icon': task.type_agile_icon,
            'type_agile_icon_color': task.type_agile_icon_color,
            'priority_agile_icon': task.priority_agile_icon,
            'priority_agile_icon_color': task.priority_agile_icon_color,
            'story_points': task.story_points or 0,
            'project_id': [task.project_id.id, task.project_id.name],
            'stage_id': task.stage_id.id,
            'stage_name': task.stage_name,
            'type_id': [task.type_id.id, task.type_id.name],
            'priority_id': [task.priority_id.id, task.priority_id.name],
            'user_id': task.user_id.id,
            'parent_id': task.parent_id.id,
            'parent_key': task.parent_key,
            'child_ids': [t.id for t in task.child_ids],
            'is_user_story': task.is_user_story,
            'wkf_state_type': task.wkf_state_type,
        }

    def prepare_user(self, user):
        return {
            'id': user.id,
            'name': user.name,
            # 'image_small': user.image_small,
        }

    def prepare_state(self, state):
        return {
            'id': state.id,
            'name': state.name,
            'stage_id': state.stage_id.id,
            'global_in': state.is_global,
            'global_out': state.is_global,
            'type': state.type,
            'workflow_id': state.workflow_id.id,
            'in_transitions': [x['id'] for x in state.in_transitions],
            'out_transitions': [x['id'] for x in state.out_transitions],
        }

    def prepare_transition(self, transition):
        return {
            'id': transition.id,
            'name': transition.name,
            'description': transition.description,
            'src': transition.src_id.id,
            'dst': transition.dst_id.id,
            'workflow_id': transition.workflow_id.id,
            'user_confirmation': transition.user_confirmation,
        }

    def prepare_workflow(self, workflow):
        wkf = {
            'id': workflow.id,
            'name': workflow.name,
            'description': workflow.description,
            'states': {},
            'transitions': {},
        }
        for state in workflow.state_ids:
            wkf['states'][state.id] = self.prepare_state(state)
        for transition in workflow.transition_ids:
            wkf['transitions'][transition['id']] = self.prepare_transition(transition)

        return wkf

    def prepare_project(self, project):
        return {
            'id': project.id,
            'name': project.name,
            'workflow_id': project.workflow_id.id,
        }

    def prepare_column(self, column):
        return {
            'id': column.id,
            'name': column.name,
            'order': column.order,
        }

    def prepare_status(self, status, column):
        return {
            'id': status.id,
            'state_id': status.state_id.id,
            'order': status.order,
            'column_id': column.id,
        }

    @http.route('/agile/activity-stream', type='json', auth='user')
    def activity_stream(self, **k):
        projects_in_team = request.env['project.project'].search([("team_ids", "in", [request.env.user.team_id.id])]).ids
        team_tasks = request.env['project.task'].search([
            # ('team_id', '=', request.env.user.team_id.id)
            ('project_id', 'in', projects_in_team)
        ]).ids
        return request.env['mail.message'].search_read([
            ('model', '=', 'project.task'),
            ('res_id', 'in', team_tasks),
            '|',
            ('message_type', '=', 'comment'),
            ('subtype_id', 'in', k['subtype_ids'])
        ], limit=k.get('limit', False))

    @http.route('/agile/session_user', type='json', auth='user')
    def session_user(self):
        user = request.env.user
        return {
            "id": user.id,
            "__last_update": user.write_date,
            "name": user.name,
            "groups_id": user.groups_id.ids,
            "team_ids": self.prepare_user_teams(user.team_ids),
            "team_id": user.team_id.id
        }

    def prepare_user_teams(self, team_ids):
        result = {}
        for team in team_ids:
            result[team.id] = self.prepare_user_team(team)
        return result

    def prepare_user_team(self, team):
        return {
            "id": team.id,
            "name": team.name,
            "project_ids": team.project_ids.ids,
        }

    @http.route('/agile/security', type='json', auth='user')
    def security(self):
        result = {}
        request.cr.execute("""
        SELECT m.model, bool_or(a.perm_create) c, bool_or(a.perm_read) r, bool_or(a.perm_write) u, bool_or(a.perm_unlink) d FROM ir_model_access a
        JOIN ir_model m ON (m.id = a.model_id)
        WHERE a.active AND
        m.model IN %s AND
        (a.group_id IN %s OR a.group_id IS NULL)
        GROUP BY m.model
        """, (tuple(self.get_security_models()), tuple(request.env.user.groups_id.ids)))
        for a in request.cr.dictfetchall():
            result[a['model']] = a
            del result[a['model']]['model']  # we don't need model since it is key
        pass
        return result

    def get_security_models(self):
        return [
            "project.agile.board.column.status",
            "project.agile.team",
            "project.agile.board.column",
            "project_agile.code_item",
            "project.agile.board",
            "project_agile.board.importer",
            "project.agile.board.export.wizard",
            "project_agile.board.xml.reader",
            "project_agile.board.import.wizard",
            "project_agile.board.xml.writer",
        ]

    @http.route('/agile/model/info', type='json', auth='user')
    def agile_model_info(self, model_name):
        model_obj = request.env[model_name]

        result = {
            'name': model_name,
            'sync': getattr(model_obj, "_implements_syncer", False),
            'fields': {}
        }

        for field_name in model_obj._fields:
            field = model_obj._fields[field_name]

            if not field._attrs.get("agile", False):
                continue

            result['fields'][field.name] = {
                'name': field.name,
                'type': field.type,
                'comodel_name': field.comodel_name,
                'inverse_name': field.type == 'one2many' and field.inverse_name or False,
                'string': field.string,
                'help': field.help,
                'required': field.required,
                'readonly': field.readonly,
            }

        return result

    def get_task_url(self, key):
        env = request.env()

        Task = env['project.task']
        tasks = Task.search([('key', '=ilike', key)])

        task_url = "agile/web?#page=board&project=%s&task=%s&view=task" % (tasks and tasks.project_id.id or -1,
                                                                           tasks and tasks.id or -1)
        return task_url

    def get_project_url(self, key):
        env = request.env()

        Project = env['project.project']
        projects = Project.search([('key', '=ilike', key)])
        if not projects.exists():
            return False

        project_url = "agile/web?#page=board&project=%s&view=%s" % (projects and projects.id or -1,
                                                                    projects and projects.agile_method or '')
        return project_url

    @http.route('/agile/browse/<string:key>', type='http', auth="user")
    def browse(self, key, **kwargs):
        redirect_url = self.get_project_url(key)
        if not redirect_url:
            redirect_url = self.get_task_url(key)
        return werkzeug.utils.redirect(redirect_url or '', 301)
