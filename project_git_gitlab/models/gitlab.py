# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields

TYPE = [('gitlab', 'GitLab')]


class GitUser(models.Model):
    _inherit = 'project.git.user'

    type = fields.Selection(
        selection_add=TYPE,
    )


class GitRepository(models.Model):
    _inherit = 'project.git.repository'

    type = fields.Selection(
        selection_add=TYPE,
    )


class GitCommit(models.Model):
    _inherit = 'project.git.commit'

    type = fields.Selection(
        selection_add=TYPE,
    )


class GitBranch(models.Model):
    _inherit = 'project.git.branch'

    type = fields.Selection(
        selection_add=TYPE,
    )
