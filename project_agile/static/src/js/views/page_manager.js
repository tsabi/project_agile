// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.page_manager', function (require) {
    "use strict";

    var web_core = require('web.core');
    var _t = web_core._t;
    var core = require('project_agile.core');
    var bus = core.bus;
    var hash_service = require('project_agile.hash_service');
    var AgileBaseWidget = require('project_agile.BaseWidgets').AgileBaseWidget;
    var DashboardPage = require('project_agile.page.dashboard').DashboardPage;
    var BoardPage = require('project_agile.page.board');

    var qweb = core.qweb;

    // Key is used to define what string should be used in hash_service for ViewManager
    var PageManager = AgileBaseWidget.extend({
        key: "page",
        id: "middle",
        _name: "Page Manager",
        init(parent, options = {}){
            this._super(parent, options);
            Object.assign(this, options);
            this._require_prop("key");
            this._require_prop("defaultView");

            this.build_view_registry();
            this.instantiate_views();
            bus.on('team:changed', null, (team_id, team_changing) => {
                data.cache.get("current_user").then(user => {
                    if (user.team_ids[user.team_id].project_ids.length) {
                        this.rerender_view({team_changing});
                    }
                    else {
                        this.set_view("dashboard", {team_changing});
                    }
                });
            });
        },

        instantiate_views(){
            //Subscribe to view change event on hash service
            hash_service.on("change:" + this.key, this, (hash_service, options) => this.set_view(options.newValue));
            //hash_service.on("change:project", this, (hash_service, options) =>{
            //    if(hash_service.get("view") == "backlog"){
            //        this.set_view("backlog");
            //    }else{
            //        hash_service.set("view","backlog");
            //    }
            //
            //});
        },

        renderElement(){
            this._super();
            this.$el.prepend($("<div id='middle-offset'/>"));
            // set default view if none is set
            if (!hash_service.get(this.key)) {
                hash_service.setHash(this.key, this.defaultView, false);
            } else {
                this.set_view(hash_service.get(this.key));
            }
        },
        set_view(view_name, options = {}){
            if (this.view_registry.get(view_name)) {
                this.current_view = view_name;
                let ViewWidget = this.view_registry.get(view_name);

                // Checking if ViewWidget is AgileBaseWidget subclass,
                // I've been able to identify that it is subclass of root OdooClass
                // TODO: Test if ViewWidget is extension of AgileBaseWidget
                if (!ViewWidget.toString().includes("OdooClass")) {
                    throw new Error(_t("Widget does not exist"));
                }

                // if current widget property is set, and has destroy method, call it to destroy widget.
                if (this.widget && typeof this.widget.destroy === "function") {
                    this.widget.destroy();
                }

                // Instantiate ViewWidget with this as parent and add it to DOM.
                this.widget = new ViewWidget(this, options);
                this.widget.appendTo(this.$el);
                console.log(this.message = "View " + view_name + " loaded...");
            } else {
                throw new Error(_t("View ") + view_name + _t(" does not exist!"));
            }
        },
        rerender_view(options){
            this.set_view(this.current_view, options);
        },
        // Overwrite this method and call this._super() in order to add additional views to registry
        // view_registry is map with view name as key and widget class as value
        // All view widgets should extend AgileViewWidget, and set appropriate title property
        build_view_registry(){
            this.view_registry = new Map();
            this.view_registry.set("dashboard", DashboardPage);
            this.view_registry.set("board", BoardPage);
        }
    });

    return PageManager

});