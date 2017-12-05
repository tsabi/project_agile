# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields, exceptions, _


class AgileSystemCodeItem(models.AbstractModel):
    _name = 'project.agile.code_item'
    _description = 'Agile Code Item'
    _order = 'sequence'

    name = fields.Char(
        string="Name",
        required=True,
        agile=True,
    )

    description = fields.Html(
        string="Description",
        required=False,
        agile=True,
    )

    agile_icon = fields.Char(
        string='Agile Icon',
        agile=True,
    )

    agile_icon_color = fields.Char(
        string='Agile Icon Color',
        agile=True,
    )

    system = fields.Boolean(
        string='Is System Type',
        readonly=True,
        default=False,
        agile=True,
    )

    active = fields.Boolean(
        string='Active',
        default=True,
        agile=True,
    )

    sequence = fields.Integer(
        string='Sequence',
        default=10,
        agile=True,
    )

    def unlink(self, cr, uid, ids, context=None):
        for item in self.browse(cr, uid, ids, context=context):
            if item.system:
                raise exceptions.ValidationError(
                    _("%s '%s' is a system record!\nYou are not allowed to delete system record!" %
                      (self._description or self._name, item.name_get()[0][1]))
                )
