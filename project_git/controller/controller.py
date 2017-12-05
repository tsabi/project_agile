# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import logging, json
from abc import abstractmethod, ABCMeta

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class Parser(object):
    __metaclass__ = ABCMeta

    @abstractmethod
    def __init__(self, type, data):
        self.type = type
        self.data = data

    @abstractmethod
    def get_repository_owner_data(self):
        """ Prepare data for creating repository owner """
        pass

    @abstractmethod
    def get_repository_data(self):
        """ Prepare data for creating repository """
        pass

    @abstractmethod
    def get_pushes(self):
        """ Get all pushes from webhook """
        pass

    @abstractmethod
    def get_branch_data(self, push):
        """ Preapare data for creating branch from push """
        pass

    @abstractmethod
    def get_commits(self, push):
        """ Get all commits data from push """
        pass

    @abstractmethod
    def get_commit_author_data(self, commit):
        """ Preapare data for creating commit author from commit data """
        pass

    @abstractmethod
    def get_commit_data(data, commit):
        """ Preapare data for creating commit from commit data"""
        pass

    @abstractmethod
    def request_type(self):
        pass


class GitController(http.Controller):

    def process_request(self, data):
        repository = request.env["project.git.repository"].sudo().search([
            ("odoo_uuid", '=', request.httprequest.values["uuid"]),
            ("type", "=", data.type)], limit=1
        )

        if not repository:
            return json.dumps({"response": "Repository in odoo not found!"})

        return getattr(self, data.request_type())(repository, data)

    def store(self, repository, data):
        import json, re

        def prepare_key(key, pk_len):
            key = key.replace(" ", "")
            if key[pk_len] != '-':
                key = key[:pk_len] + '-' + key[pk_len:]
            return key

        try:
            # UPDATE/CREATE Repository owner
            repository_owner_data = data.get_repository_owner_data()
            repository_owner_data["type"] = data.type
            repository_owner = request.env["project.git.user"].sudo().search([
                ("username", '=', repository_owner_data["username"]),
                ("type", "=", data.type)
            ], limit=1)
            if repository_owner:
                repository_owner.sudo().write(repository_owner_data)
            else:
                repository_owner = request.env["project.git.user"].sudo().create(repository_owner_data)
            ###############################

            # UPDATE/CREATE Repository
            repository_data = data.get_repository_data()
            repository_data["user_id"] = repository_owner.id
            repository_data["type"] = data.type
            repository.sudo().write(repository_data)
            ###############################

            # UPDATE/CREATE Branch

            for push in data.get_pushes():
                branch_data = data.get_branch_data(push)
                branch_data["repository_id"] = repository.id
                branch_data["type"] = data.type
                branch = request.env["project.git.branch"].sudo().search([
                    ("name", '=', branch_data["name"]),
                    ("repository_id", "=", branch_data["repository_id"]),
                    ("type", "=", data.type)
                ], limit=1)
                if branch:
                    branch.sudo().write(branch_data)
                else:
                    branch = request.env["project.git.branch"].sudo().create(branch_data)
                ###############################

                commits = data.get_commits(push)
                for commit in commits:

                    # UPDATE/CREATE Commit Author
                    commit_author_data = data.get_commit_author_data(commit)
                    commit_author_data["type"] = data.type
                    commit_author = request.env["project.git.user"].sudo().search([
                        ("username", '=', commit_author_data["username"]),
                        ("type", "=", data.type)
                    ], limit=1)

                    if commit_author:
                        commit_author.sudo().write(commit_author_data)
                    else:
                        commit_author = request.env["project.git.user"].sudo().create(commit_author_data)
                    ###############################

                    commit_data = data.get_commit_data(commit)
                    commit_data["branch_id"] = branch.id
                    commit_data["author_id"] = commit_author.id

                    if not repository.project_id:
                        continue
                    pattern = re.compile(repository.project_id.key + " ?-? ?[0-9]+")
                    task_keys = []
                    for key in re.findall(pattern, commit_data["message"]):
                        task_keys.append(prepare_key(key, len(repository.project_id.key)))
                    tasks = request.env["project.task"].sudo().search([("key", "in", task_keys)])
                    if len(tasks) == 0:
                        continue
                    commit_data["task_ids"] = [(6, 0, tasks.ids)]

                    commit_records = request.env["project.git.commit"].sudo().search([
                        ("name", '=', commit_data["name"]),
                        ("type", "=", data.type)
                    ], limit=1)

                    if commit_records:
                        commit_records.sudo().write(commit_data)
                    else:
                        request.env["project.git.commit"].sudo().create(commit_data)

                    # CREATE messages for commit on each task
                    author_partner = request.env["res.partner"].sudo().search([("email", "=", commit_author_data["email"])])
                    author_partner_id = author_partner and author_partner.id or None
                    for task in tasks:
                        message_data = {
                            'body': "Commit created<br/><a href='%s' target='_blank'>%s</a> - %s" % (
                            commit_data['url'], commit_data['name'], commit_data['message']),
                            'model': 'project.task',
                            'res_id': task.id,
                            'message_type': 'notification',
                            'subtype_id': request.env.ref("project_git.mt_task_code_committed").id,
                            'subject': 'Commit ' + commit_data['name'],
                            'author_id': author_partner_id
                        }
                        if not author_partner_id:
                            message_data['email_from'] = "%s <%s>" % (commit_author_data['name'], commit_author_data['email'])
                        request.env["mail.message"].sudo().create(message_data)

            return json.dumps({"response": "Ok"})
        except BaseException as e:
            import json, traceback
            return json.dumps({"response": traceback.format_exc()})

    def delete(self, repository, data):
        for push in data.get_pushes():
            branch_data = data.get_branch_data(push)
            branch_data["repository_id"] = repository.id
            branch_data["type"] = data.type
            branch = request.env["project.git.branch"].sudo().search([
                ("name", '=', branch_data["name"]),
                ("repository_id", "=", branch_data["repository_id"]),
                ("type", "=", data.type)
            ], limit=1)

            if branch:
                branch.unlink()
