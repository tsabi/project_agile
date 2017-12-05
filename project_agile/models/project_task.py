# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api, tools, exceptions, _
from ..tools import xmlid_to_action, xmlid_to_res_id
import logging

_logger = logging.getLogger(__name__)


class TaskResolution(models.Model):
    _name = 'project.task.resolution'
    _description = 'Task Resolution'
    _inherit = ['project.agile.code_item']


class ProjectTaskLinkRelation(models.Model):
    _name = "project.task.link.relation"
    _description = 'Project Task Link Relation Type'

    name = fields.Char(
        string="Name",
        required=True,
        agile=True
    )

    inverse_name = fields.Char(
        string="Reverse Name",
        required=True,
        agile=True
    )

    sequence = fields.Integer(
        string="Order",
        required=True,
        agile=True
    )


class ProjectTaskLink(models.Model):
    _name = "project.task.link"
    _description = "Project Task Link"

    name = fields.Char(
        string="Name",
        compute="_compute_display_name",
        agile=True
    )

    comment = fields.Char(
        string="Comment",
        agile=True
    )

    relation_id = fields.Many2one(
        comodel_name="project.task.link.relation",
        string="Relation",
        required=True,
        agile=True
    )

    task_left_id = fields.Many2one(
        comodel_name="project.task",
        string="Task on the left",
        required=True,
        ondelete="cascade",
        agile=True,
    )

    task_right_id = fields.Many2one(
        comodel_name="project.task",
        string="Task on the right",
        required=True,
        ondelete="cascade",
        agile=True,
    )

    relation_name = fields.Char(
        string="Relation",
        compute="_get_relation_name",
        agile=True,
    )

    related_task_id = fields.Many2one(
        comodel_name="project.task",
        string="Related task",
        compute="_get_related_task",
        agile=True,
    )

    def _get_relation_name(self):
        for record in self:
            task_id = self._context.get('task_id')

            if task_id and task_id == record.task_right_id.id:
                record.relation_name = record.relation_id.inverse_name
            else:
                record.relation_name = record.relation_id.name

    def _get_related_task(self):
        # TODO: Baci exception ako task_id nije postavljen
        for record in self:
            task_id = self._context.get('task_id')
            if task_id and task_id == record.task_right_id.id:
                record.related_task_id = record.task_left_id
            else:
                record.related_task_id = record.task_right_id
        return

    def _compute_display_name(self):
        for record in self:
            task_id = self._context.get('task_id')

            if task_id and task_id == record.task_right_id.id:
                record.name = record.task_left_id.name
            else:
                record.name = record.task_right_id.name

    @api.multi
    def delete_task_link(self):
        self.ensure_one()
        self.unlink()

    @api.multi
    def open_task_link(self):
        self.ensure_one()
        return {
            'name': "Related task",
            'view_mode': 'form',
            'view_type': 'form',
            'view_id': self.env.ref("project.view_task_form2").id,
            'res_model': 'project.task',
            'type': 'ir.actions.act_window',
            'res_id': self.related_task_id.id,
            'context': {
                'active_model': "project.task",
                'active_ids': [self.related_task_id.id],
                'active_id': self.related_task_id.id
            },
        }


class TaskType(models.Model):
    _name = 'project.task.type2'
    _description = "Task Type"
    _inherit = ['project.agile.code_item']

    project_type_ids = fields.Many2many(
        comodel_name='project.type',
        relation="project_type_task_type_rel",
        column1="task_type_id",
        column2="project_type_id",
        string="Project Types"
    )

    icon = fields.Binary(
        string='Icon'
    )

    priority_ids = fields.Many2many(
        comodel_name='project.task.priority',
        relation='project_task_type2_task_priority_rel',
        column1='type_id',
        column2='priority_id',
        string='Priorities',
        agile=True
    )

    default_priority_id = fields.Many2one(
        comodel_name='project.task.priority',
        string='Default Task Priority',
        agile=True
    )

    allow_story_points = fields.Boolean(
        string='Allow Story Points',
        default=True,
        agile=True,
    )

    allow_sub_tasks = fields.Boolean(
        string="Allow Sub-Tasks",
        default=False,
        agile=True,
    )

    type_ids = fields.Many2many(
        comodel_name='project.task.type2',
        relation='project_task_type2_sub_types_rel',
        column1='type_id',
        column2='sub_type_id',
        string='Sub Types',
        agile=True
    )

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        if args is None:
            args = []

        # This key 'selected_task_type_ids' is defined on the ``project.type`` form view.
        if 'selected_task_type_ids' in self.env.context:
            args.append((
                'id', 'in', map(lambda x: x[1], self.env.context['selected_task_type_ids'][0][2])
            ))

        return super(TaskType, self).name_search(name=name, args=args, operator=operator, limit=limit)


class TaskPriority(models.Model):
    _name = 'project.task.priority'
    _description = 'Task Priority'
    _inherit = ['project.agile.code_item']

    type_ids = fields.Many2many(
        comodel_name='project.task.type2',
        relation='project_task_type2_task_priority_rel',
        column1='priority_id',
        column2='type_id',
        string='Types',
        agile=True,
    )

    icon = fields.Binary(
        string='Icon'
    )

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        if args is None:
            args = []

        # This key 'selected_priority_ids' is defined on the ``project.task.type2`` form view.
        if 'selected_priority_ids' in self.env.context:
            args.append((
                'id', 'in', self.env.context['selected_priority_ids'][0][2]
            ))

        return super(TaskPriority, self).name_search(name=name, args=args, operator=operator, limit=limit)

    _sql_constraints = [
        ('project_task_priority_name_unique', 'unique(name)', 'Priority name already exists')
    ]


class Task(models.Model):
    _name = 'project.task'
    _inherit = ['web.syncer', 'project.task', 'project.agile.mixin.id_search']
    _sync_entire = True

    type_id = fields.Many2one(
        comodel_name='project.task.type2',
        string='Type',
        required=True,
        ondelete="restrict",
        agile=True,
    )

    resolution_id = fields.Many2one(
        comodel_name='project.task.resolution',
        string='Resolution',
        index=True,
        agile=True,
    )

    allow_story_points = fields.Boolean(
        related='type_id.allow_story_points',
        string='Allow Story Points',
        readonly=True,
        agile=True,
    )

    project_type_id = fields.Many2one(
        comodel_name='project.type',
        related='project_id.type_id',
        string='Project Type',
        readonly=True,
        agile=True,
    )

    is_user_story = fields.Boolean(
        string='Is Story',
        compute="_compute_is_story",
        store=True,
        agile=True,
    )

    @api.multi
    @api.depends('type_id')
    def _compute_is_story(self):
        story_type = self.env.ref('project_agile.project_task_type_story', raise_if_not_found=False)
        for record in self:
            record.is_user_story = story_type and record.type_id.id == story_type.id or False

    is_epic = fields.Boolean(
        string='Is Epic',
        compute="_compute_is_epic",
        store=True,
    )

    @api.multi
    @api.depends('type_id')
    def _compute_is_epic(self):
        epic_type = self.env.ref('project_agile.project_task_type_epic', raise_if_not_found=False)
        for record in self:
            record.is_epic = epic_type and record.type_id.id == epic_type.id or False

    epic_id = fields.Many2one(
        comodel_name='project.task',
        string='Epic',
        compute="_compute_epic_id",
        store=True,
        readonly=True,
        agile=True,
        help='This field represents the first'
    )

    @api.multi
    @api.depends('parent_id', 'parent_id.epic_id')
    def _compute_epic_id(self):
        epic_type = self.env.ref('project_agile.project_task_type_epic', raise_if_not_found=False)

        if epic_type:
            for record in self:
                epic_id = False
                if epic_type:
                    current = record.parent_id
                    while current:
                        if current.type_id.id == epic_type.id:
                            epic_id = current.id
                            break
                        current = current.parent_id
                record.epic_id = epic_id
        else:
            for record in self:
                record.epic_id = False

    assigned_to_me = fields.Boolean(
        string='Assigned to Me',
        compute="_compute_assigned_to_me"
    )

    @api.multi
    @api.depends('user_id')
    def _compute_assigned_to_me(self):
        for task in self:
            task.assigned_to_me = task.user_id.id == self.env.user.id

    user_id = fields.Many2one(
        comodel_name="res.users",
        default=False,
        agile=True
    )

    create_uid = fields.Many2one(
        comodel_name='res.users',
        string='Reported By',
        readonly=True,
        agile=True,
    )

    create_date = fields.Datetime(
        string='Created',
        readonly=True,
        agile=True,
    )

    write_date = fields.Datetime(
        string='Updated',
        readonly=True,
        agile=True,
    )

    type_agile_icon = fields.Char(
        string='Type Agile Icon',
        related="type_id.agile_icon",
        agile=True,
    )

    type_agile_icon_color = fields.Char(
        string='Type Agile Icon Color',
        related="type_id.agile_icon_color",
        agile=True,
    )

    priority_agile_icon = fields.Char(
        string='Priority Agile Icon',
        related="priority_id.agile_icon",
        agile=True,
    )

    priority_agile_icon_color = fields.Char(
        string='Priority Agile Icon Color',
        related="priority_id.agile_icon_color",
        agile=True,
    )

    team_id = fields.Many2one(
        comodel_name="project.agile.team",
        string="Committed team",
        agile=True,
    )

    type_ids = fields.Many2many(
        comodel_name='project.task.type2',
        related="type_id.type_ids",
        readonly=True,
        string='Allowed Subtypes'
    )

    task_count = fields.Integer(
        compute="_get_task_count",
        string="Number of SubTasks"
    )

    @api.multi
    def _get_task_count(self):
        for record in self:
            record.task_count = len(record.child_ids)

    allow_sub_tasks = fields.Boolean(
        related="type_id.allow_sub_tasks",
        string="Allow Sub-Tasks",
        stored=True,
        agile=True,
    )

    url = fields.Char(
        string='URL',
        compute="_compute_url",
        readonly=True,
    )

    @api.multi
    @api.depends('key')
    def _compute_url(self):
        task_action = self.env.ref('project.action_view_task')
        for task in self:
            task_url = "/web#id=%s&view_type=form&model=project.task&action=%s" % (task.id, task_action.id)
            task.url = task_url


    # def _get_default_priority_id(self):
    #     return self.type_id and self.type_id.default_priority_id and self.type_id.default_priority_id.id or False

    priority_id = fields.Many2one(
        comodel_name='project.task.priority',
        string='Priority',
        required=True,
        ondelete="restrict",
        agile=True,
        # default=_get_default_priority_id,
    )

    story_points = fields.Integer(
        string='Story points',
        agile=True,
        default=0
    )

    def _compute_agile_order(self):
        self.env.cr.execute("SELECT MAX(agile_order) + 1 FROM project_task")
        r = self.env.cr.fetchone()
        return r[0]

    agile_order = fields.Float(
        required=False,
        default=_compute_agile_order,
        agile=True
    )

    doc_count = fields.Integer(compute="_compute_doc_count", string="Number of documents attached")

    @api.multi
    def _compute_doc_count(self):
        for record in self:
            record.doc_count = self.env['ir.attachment'].search(
                [('res_model', '=', 'project.task'), ('res_id', '=', record.id)],
                count=True
            ) or 0

    link_ids = fields.One2many(
        comodel_name="project.task.link",
        compute="_get_links",
        string="Links",
        agile=True
    )

    @api.multi
    def _get_links(self):
        for record in self:
            record.link_ids = self.env["project.task.link"].search([
                "|", ("task_left_id", "=", record.id), ("task_right_id", "=", record.id)
            ])

    link_count = fields.Integer(
        compute="_compute_link_count",
        string="Number of Links"
    )

    @api.multi
    def _compute_link_count(self):
        for record in self:
            record.link_count = len(record.link_ids)

    project_last_update = fields.Datetime(
        related='project_id.__last_update',
        readonly=True,
        agile=True
    )

    user_last_update = fields.Datetime(
        related='user_id.__last_update',
        readonly=True,
        agile=True
    )

    stage_name = fields.Char(
        related='stage_id.name',
        readonly=True,
        agile=True
    )

    parent_key = fields.Char(
        related='parent_id.key',
        readonly=True,
        agile=True
    )

    # Following is the list of inherited fields which we want to register as agile related fields
    name = fields.Char(agile=True)
    key = fields.Char(agile=True)
    effective_hours = fields.Float(agile=True)
    description = fields.Html(index=True, agile=True)
    color = fields.Integer(agile=True)
    date_deadline = fields.Date(agile=True)
    wkf_state_type = fields.Selection(agile=True)
    project_id = fields.Many2one(comodel_name='project.project', agile=True)
    parent_id = fields.Many2one(comodel_name='project.task', agile=True)
    stage_id = fields.Many2one(comodel_name='project.task.type', agile=True)
    wkf_state_id = fields.Many2one(comodel_name='project.workflow.state', agile=True)
    workflow_id = fields.Many2one(comodel_name='project.workflow', agile=True)
    child_ids = fields.One2many(comodel_name='project.task', agile=True)
    timesheet_ids = fields.One2many(comodel_name='account.analytic.line', agile=True)
    attachment_ids = fields.One2many(comodel_name='ir.attachment', inverse_name='res_id', agile=True)
    tag_ids = fields.Many2many(comodel_name='project.tags', agile=True)

    # API methods override
    @api.model
    @api.returns('self', lambda value: value.id)
    def create(self, vals):
        project_id = vals.get('project_id', self.env.context.get('default_project_id', False))
        if project_id:

            project = self.env['project.project'].browse(project_id)

            if not vals.get('type_id', False):
                default_type_id = self.env.context.get('default_type_id', False)
                if default_type_id:
                    vals['type_id'] = default_type_id
                else:
                    vals['type_id'] = project.type_id.default_task_type_id.id or False

            if not vals.get('priority_id', False) and vals.get('type_id'):
                task_type = self.env['project.task.type2'].browse(vals.get('type_id'))
                vals['priority_id'] = task_type.default_priority_id.id or False

        return super(Task, self).create(vals)

    @api.model
    def name_search(self, name='', args=None, operator='ilike', limit=100):
        if args is None:
            args = []

        if 'filter_user_stories' in self.env.context:
            args.append((
                'type_id', '=', xmlid_to_res_id(self, 'project_agile.project_task_type_story')
            ))

        return super(Task, self).name_search(name=name, args=args, operator=operator, limit=limit)

    def search(self, args, offset=0, limit=None, order=None, count=False):
        if args is None:
            args = []

        if 'filter_user_stories' in self.env.context:
            args.append((
                'type_id', '=', xmlid_to_res_id(self, 'project_agile.project_task_type_story')
            ))

        if 'filter_tasks' in self.env.context:
            args.append((
                'type_id', '=', xmlid_to_res_id(self, 'project_agile.project_task_type_task')
            ))

        return super(Task, self).search(args, offset, limit, order, count)

    # On Change
    @api.onchange('project_id')
    def _onchange_project(self):
        super(Task, self)._onchange_project()

        context_default_type_id = self.env.context.get('default_type_id', False)

        if self.project_id:
            task_type_id = self.project_id.type_id.default_task_type_id.id
            if context_default_type_id and self.project_id.type_id.has_task_type(context_default_type_id):
                task_type_id = context_default_type_id

            self.type_id = task_type_id
        else:
            self.type_id = False

    @api.onchange('type_id')
    def _onchange_type_id(self):
        self.priority_id = self.type_id and self.type_id.default_priority_id and self.type_id.default_priority_id.id or False

    # Action Methods
    @api.multi
    def open_sub_task(self):
        self.ensure_one()
        ctx = self._context.copy()
        ctx.update({
            'active_model': "project.task",
            'active_ids': [self.id],
            'active_id': self.id
        })
        return {
            'name': "Sub-Task",
            'view_mode': 'form',
            'view_type': 'form',
            'view_id': self.env.ref("project.view_task_form2").id,
            'res_model': 'project.task',
            'type': 'ir.actions.act_window',
            'res_id': self.id,
            'context': ctx,
        }

    @api.multi
    def attachment_tree_view(self):
        self.ensure_one()

        action = xmlid_to_action(self, "base.action_attachment")

        action['domain'] = [('res_model', '=', 'project.task'), ('res_id', '=', self.id)]
        action['help'] = '''<p class="oe_view_nocontent_create">
                               Documents are attached to the tasks and issues of your project.</p><p>
                               Send messages or log internal notes with attachments to link
                               documents to your project.
                           </p>'''
        action['context'] = {
            'default_res_model': self._name,
            'default_res_id': self.id,
        }

        return action

    # Following methods will be called from hooks file, so we can leave ``project.task`` in valid state.
    @api.model
    def _set_default_task_priority_id(self):
        for res in self.with_context(active_test=False).search([('priority_id', '=', False)]):
            res.priority_id = res.type_id.default_priority_id or False

    @api.model
    def _set_default_task_type_id(self):
        for task in self.with_context(active_test=False).search([('type_id', '=', False)]):
            task.type_id = task.project_id.type_id.default_task_type_id.id or False
