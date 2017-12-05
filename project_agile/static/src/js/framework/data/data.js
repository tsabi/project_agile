// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.data', function (require) {
    "use strict";
    const DataSet = require('project_agile.dataset');
    const bus = require('bus.bus');
    const session = require('web.session');
    const Model = require('web.Model');
    const Syncer = require('web.syncer').Syncer;
    const DependencyCache = require('project_agile.dependency_cache');
    const cache = new DependencyCache.DependencyCache();
    const getMessages = function (model, res_id, type, subtype) {
        let domain = [
            ["model", "=", model],
            ["res_id", "=", res_id]
        ];
        type && (Array.isArray(type) ? domain.push(["message_type", "in", type]) : domain.push(["message_type", "=", type]));
        subtype && (Array.isArray(subtype) ? domain.push(["subtype_id", "in", subtype]) : domain.push(["subtype_id", "=", subtype]));
        return DataSet.get("mail.message").read_slice([], {domain})
    };
    const getImage = function (model, id, last_update, field = "image_small") {
        return session.url('/web/image', {
            model, id, field,
            unique: (last_update || '').replace(/[^0-9]/g, '')
        });
    };
    const getTaskLinks = function (taskId) {
        return session.rpc(`/agile/web/data/task/${taskId}/get_task_links`, {context: {task_id: taskId}})
    };

    window.data = {
        cache,
        getDataSet: DataSet.get,
        getMessages,
        getImage,
        getTaskLinks,
        Model,
        session,
        bus,
        sync: new Syncer()
    };
    return window.data;
});