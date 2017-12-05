# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import re
from odoo import http
from odoo.addons.project_git.controller.controller import GitController, Parser


class BitBucketParser(Parser):

    def __init__(self, data):
        Parser.__init__(self, 'bitbucket', data)

    def get_repository_owner_data(self):
        return {
            'name': self.data['repository']['owner']['display_name'],
            'username': self.data['repository']['owner']['username'].lower(),
            'uuid': self.data['repository']['owner']['uuid'][1:-1],
            'avatar': self.data['repository']['owner']['links']['avatar']['href'],
            'url': self.data['repository']['owner']['links']['html']['href'],
        }

    def get_repository_data(self):
        return {
            'name': self.data['repository']['name'],
            'full_name': self.data['repository']['full_name'],
            'uuid': self.data['repository']['uuid'][1:-1],
            'url': self.data['repository']['links']['html']['href'],
        }

    def get_pushes(self):
        return self.data['push']['changes']

    def get_branch_data(self, push):
        return {
            'name': push['new']['name'],
            'url': push['new']['links']['html']['href']
        }

    def get_commits(self, push):
        return push['commits']

    def get_commit_author_data(self, commit):
        return {
            'name': commit['author']['user']['display_name'],
            'username': commit['author']['user']['username'].lower(),
            'uuid': commit['author']['user']['uuid'][1:-1],
            'avatar': commit['author']['user']['links']['avatar']['href'],
            'url': commit['author']['user']['links']['html']['href'],
            'email': re.search('%s(.*)%s' % ('<', '>'), commit['author']['raw']).group(1)
        }

    def get_commit_data(self, commit):
        from dateutil.parser import parse
        return {
            'name': commit['hash'][:8],
            'message': commit['message'],
            'url': commit['links']['html']['href'],
            'date': parse(commit['date']).strftime('%Y-%m-%d %H:%M:%S'),
        }

    def request_type(self):
        return 'store'


class BitBucketController(GitController):

    @http.route(['/bitbucket/sync'], type='json', auth='public', website=True)
    def process_request_bitbucket(self, *args, **kw):
        return self.process_request(BitBucketParser(http.request.jsonrequest))




