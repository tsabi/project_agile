# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api
from ..utils.utils import get_image_type, get_avatar, urljoin
import urllib, uuid


class GitRepository(models.Model):
    _name = 'project.git.repository'

    name = fields.Char(
        string='Name',
        size=256,
    )

    uuid = fields.Char(
        string='UUID',
        size=256
    )

    full_name = fields.Char(
        string='Full Name',
        size=256
    )

    odoo_uuid = fields.Char(
        string='UUID',
        size=256,
        default=lambda *a: uuid.uuid4()
    )

    avatar = fields.Char(
        string='Avatar',
        compute='_compute_avatar',
    )

    url = fields.Char(
        string='URL',
        default='#'
    )

    project_id = fields.Many2one(
        comodel_name='project.project',
        string='Project',
        required=True
    )

    branch_ids = fields.One2many(
        comodel_name='project.git.branch',
        string='Branches',
        inverse_name='repository_id'
    )

    user_id = fields.Many2one(
        comodel_name='project.git.user',
        string='Owner',
        ondelete='cascade',
    )

    type = fields.Selection(
        selection=[],
        string='Type'
    )

    webhook_url = fields.Char(
        string='Webhook Url',
        compute='_compute_webhook_url',
    )

    bitbucket_webhook_url = fields.Char(
        string='Bitbucket Webhook Url',
        compute='_compute_bitbucket_webhook_url',
    )

    github_webhook_url = fields.Char(
        string='Github Webhook Url',
        compute='_compute_github_webhook_url',
    )

    image_type = fields.Char(
        string='Type',
        compute='_calculate_image_type'
    )

    @api.multi
    @api.depends('type')
    def _compute_avatar(self):
        get_avatar(self, 'repository')

    @api.multi
    @api.depends('type')
    def _calculate_image_type(self):
        get_image_type(self)

    @api.multi
    @api.onchange('project_id', 'type')
    def _calculate_name(self):
        for record in self:
            record.name = 'Repo {} {}'.format(
                record.project_id and record.project_id.key or '',
                record.get_name_from_selection(record.type)
            )



    @api.multi
    def get_name_from_selection(self, type):
        self.ensure_one()
        for key, val in self._fields['type']._attrs.iteritems():
            if 'selection' in key:
                for elem in val:
                    if elem[0] == type:
                        return elem[1]
        return ''


    @api.multi
    @api.depends('odoo_uuid')
    @api.onchange('type')
    def _compute_webhook_url(self):
        base_url = self.env['ir.config_parameter'].get_param('web.base.url')
        for record in self:
            if not record.type: continue
            record.webhook_url = '%s?%s' % (
                urljoin(base_url, record.type, 'sync'),
                urllib.urlencode({'db': self.env.cr.dbname, 'uuid': record.odoo_uuid})
            )