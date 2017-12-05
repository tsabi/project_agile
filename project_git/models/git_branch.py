# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api
from ..utils.utils import get_image_type, get_avatar


class GitBranch(models.Model):
    _name = "project.git.branch"

    name = fields.Char(
        string="Name",
        size=256,
        required=True
    )

    url = fields.Char(
        string="URL",
        required=True
    )

    uuid = fields.Char(
        string="UUID",
        size=256
    )

    repository_id = fields.Many2one(
        comodel_name="project.git.repository",
        string="Repository",
        ondelete="cascade",
    )

    project_id = fields.Many2one(
        comodel_name="project.project",
        string="Project",
        related="repository_id.project_id",
        store=True
    )

    type = fields.Selection(
        selection=[],
        string="Type",
        required=False,
        related="repository_id.type",
        store=True
    )

    commit_ids = fields.One2many(
        comodel_name="project.git.commit",
        string="Commits",
        inverse_name="branch_id"
    )

    avatar = fields.Char(
        string="Avatar",
        compute="_compute_avatar",
    )

    image_type = fields.Char(
        string="Type",
        compute="_calculate_image_type"
    )

    user_id = fields.Many2one(
        comodel_name="project.git.user",
        string="Owner",
        ondelete="cascade",
    )

    @api.multi
    def _compute_avatar(self):
        get_avatar(self, 'branch')

    @api.multi
    @api.depends("type")
    def _calculate_image_type(self):
        get_image_type(self)

