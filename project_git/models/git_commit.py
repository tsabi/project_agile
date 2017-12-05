# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api
from ..utils.utils import get_image_type, get_avatar


class GitCommit(models.Model):
    _name = "project.git.commit"

    name = fields.Char(
        string="Name",
        size=256,
        required=True
    )

    author_id = fields.Many2one(
        comodel_name="project.git.user",
        string="Author",
        required=True,
        ondelete="cascade",
    )

    message = fields.Text(
        string="Message",
        required=True,
    )

    url = fields.Char(
        string="URL",
        required=True
    )

    date = fields.Datetime(
        string="Date",
        required=True
    )

    branch_id = fields.Many2one(
        comodel_name="project.git.branch",
        string="Branch",
        ondelete="cascade"
    )

    task_ids = fields.Many2many(
        comodel_name="project.task",
        id1="commit_id",
        id2="task_id",
        relation="task_commit_rel",
        string="Tasks"
    )

    author_username = fields.Char(
        string="Username",
        related="author_id.username"
    )

    author_avatar = fields.Char(
        string="Avatar",
        related="author_id.avatar"
    )

    type = fields.Selection(
        selection=[],
        string="Type",
        required=False,
        related="branch_id.type",
        store=True
    )

    image_type = fields.Char(
        string="Type",
        compute="_calculate_image_type"
    )

    avatar = fields.Char(
        string="Avatar",
        compute="_compute_avatar",
    )

    @api.multi
    @api.depends("type")
    def _calculate_image_type(self):
        get_image_type(self)

    @api.multi
    def calculate_number(self):
        from random import randint
        return randint(0, 10)

    @api.multi
    def _compute_avatar(self):
        get_avatar(self, 'commit')