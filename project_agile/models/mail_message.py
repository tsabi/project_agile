# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from odoo import models, fields


class MailMessageSubtype(models.Model):
    _inherit = 'mail.message.subtype'

    name = fields.Char(agile=True)
    default = fields.Boolean(agile=True)
    sequence = fields.Integer(agile=True)


class Message(models.Model):
    _inherit = "mail.message"

    author_last_update = fields.Datetime(related='create_uid.__last_update', agile=True)
