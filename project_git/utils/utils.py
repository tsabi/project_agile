# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import os, urlparse


def urljoin(base_url, *args):
    postfix = os.path.join(*args)
    return urlparse.urljoin(base_url, postfix)


def get_image_type(self):
    base_url = self.env['ir.config_parameter'].get_param('web.base.url')
    for record in self:
        if not record.type: continue
        record.image_type = "{}/project_git_{}/static/src/img/{}.png".format(
            base_url, record.type, record.type
        )


def get_avatar(self, name):
    base_url = self.env['ir.config_parameter'].get_param('web.base.url')
    for record in self:
        record.avatar = urljoin(base_url, 'project_git', 'static', 'src', 'img', '{}.png'.format(name))
