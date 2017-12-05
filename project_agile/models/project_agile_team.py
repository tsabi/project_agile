# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, api, tools
import logging

_logger = logging.getLogger(__name__)


class AgileTeam(models.Model):
    _name = 'project.agile.team'
    _inherit = ['mail.thread', 'ir.needaction_mixin']

    name = fields.Char(
        string='Name'
    )

    description = fields.Html(
        string='Description'
    )

    email = fields.Char(
        string='E-mail'
    )

    member_ids = fields.Many2many(
        comodel_name='res.users',
        relation='project_agile_team_member_rel',
        column1='team_id',
        column2='member_id',
        string='Scrum Members'
    )

    project_ids = fields.Many2many(
        comodel_name="project.project",
        relation="project_project_agile_team_rel",
        column1="team_id",
        column2="project_id",
        string="Projects",
    )

    default_hrs = fields.Float(
        string='Default daily hours',
        default=8,
    )

    # image: all image fields are base64 encoded and PIL-supported
    image = fields.Binary("Image", attachment=True,
                          help="This field holds the image used as image for the agile team, limited to 1024x1024px.")

    image_medium = fields.Binary("Medium-sized image",
                                 compute='_compute_images', inverse='_inverse_image_medium', store=True,
                                 attachment=True,
                                 help="Medium-sized image of the project. It is automatically " \
                                      "resized as a 128x128px image, with aspect ratio preserved, " \
                                      "only when the image exceeds one of those sizes."
                                      " Use this field in form views or some kanban views.")

    image_small = fields.Binary("Small-sized image",
                                compute='_compute_images', inverse='_inverse_image_small', store=True, attachment=True,
                                help="Small-sized image of the project. It is automatically " \
                                     "resized as a 64x64px image, with aspect ratio preserved. " \
                                     "Use this field anywhere a small image is required.")

    @api.depends('image')
    def _compute_images(self):
        for rec in self:
            rec.image_medium = tools.image_resize_image_medium(rec.image, avoid_if_small=True)
            rec.image_small = tools.image_resize_image_small(rec.image)

    def _inverse_image_medium(self):
        for rec in self:
            rec.image = tools.image_resize_image_big(rec.image_medium)

    def _inverse_image_small(self):
        for rec in self:
            rec.image = tools.image_resize_image_big(rec.image_small)

    def my_team_members_domain(self):
        return [("member_ids", "in", self._uid)]

    def my_team_members(self):
        team = self.search(self.my_team_members_domain())
        if not team: return []

        s = set()
        team = team[0]
        users_in_team = []
        if team.master_id:
            users_in_team.append(team.master_id)
            s.add(team.master_id.id)

        for member in team.member_ids:
            if member.id not in s:
                users_in_team.append(member)
                s.add(member.id)

        return users_in_team

    @api.model
    def all_users_from_my_team(self):
        users = []
        for member in self.my_team_members():
            user = {'id': member.id, 'name': member.name, '__last_update': member.write_date}
            users.append(user)
        return users

    @api.multi
    def write(self, vals):
        if 'member_ids' in vals:
            removed_members = self.member_ids.filtered(lambda x: x.id not in vals['member_ids'][0][2])
            added_ids = filter(lambda x: x not in self.member_ids.ids, vals['member_ids'][0][2])

        res = super(AgileTeam, self).write(vals)

        if 'member_ids' in vals:
            if removed_members:
                removed_members.fix_team_id()
            if added_ids:
                self.member_ids.browse(added_ids).fix_team_id()
        return res

    @api.model
    def create(self, vals):
        res = super(AgileTeam, self).create(vals)
        res.member_ids.fix_team_id()
        return res

