// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.widget.modal', function (require) {
    "use strict";
    const BaseWidgets = require('project_agile.BaseWidgets');
    const DataServiceFactory = require('project_agile.data_service_factory');
    const task_service = DataServiceFactory.get("project.task", false);
    const data = require('project_agile.data');
    const helpers = require('project_agile.helpers');
    const Many2One = require('project_agile.widget.many2one').Many2One;
    const _t = require("web.core")._t;

    const ModalWidget = BaseWidgets.AgileBaseWidget.extend({
        validateOptions: {},
        init(parent, options) {
            this._super(parent, options);
            Object.assign(this, options);
            this.defaults = typeof this.defaults === "object" ? Object.assign(this.getDefaults(), this.defaults) : this.getDefaults();
            window.currentMdl = this;
        },
        /**
         *
         * @param options
         *
         * @param {string} options.field
         * @param {Array} options.data
         * @param {string} options.key
         * @param {string} options.value
         * @param {string} options.mdi
         * @param {string} options.iconColor
         * @param {string} options.iconUrl
         * @param {Function} options.selectedValue
         * @param {Function} options.changeHandler
         */
        prepareSelection(options) {
            // Setting project selection
            let {field, data, key = "id", value = "name", mdi, iconColor, selectedValue, changeHandler} = options;
            let optionNodes = [];

            // If data is object, convert it to array for further manipulation
            let array = Array.isArray(data) ? data : Object.keys(data).map(key => data[key]);

            for (let element of array) {
                let option = $('<option value="' + element[key] + '">' + element[value].trim() + '</option>');
                if (mdi) {
                    option.data("mdi", element[mdi]);
                }
                if (iconColor) {
                    option.data("iconColor", element[iconColor]);
                }
                optionNodes.push(option)
            }

            this.$("form [name='" + field + "'] option:not(:first)").remove();
            this.$("form " + `[name="${field}"]`).removeClass().append(...optionNodes);

            // Select default value
            if (selectedValue) {
                let select = this.$("form " + `[name="${field}"]`);
                select.val(selectedValue);
                if (changeHandler) {
                    changeHandler.bind(select[0])()
                }
            }

            this.$("form " + `[name="${field}"]`).material_select();

            this.$("form " + `[name="${field}"]`).off().change(function () {
                $(this).valid();
                if (changeHandler) {
                    changeHandler.bind(this)();
                }
            });
        },
        start() {
            let form = this.$("form");
            if (form.data("validator")) {
                Object.assign(form.data("validator").settings, this.getValidateOptions());
            }
            else {
                form.validate(this.getValidateOptions());
            }
            form.submit(e => {
                e.preventDefault();
                // This check is here to make sure that submit is triggered by
                // clicking on confirmation button and not by materialNote dropdown button
                if (!this.submitting) return;
                else this.submitting = false;

                if (!$(e.target).valid()) return;
                let formData = $(e.target).serializeObject();
                this.prepareData(formData);
                if (typeof this.beforeHook === "function") {
                    this.beforeHook(formData);
                }
                this.submit(formData, $(e.target));
                this.$el.materialModal("close");
            });
            return this._super();
        },
        /**
         * This method should return object with default values.
         * If options.defaults is passed to constructor, it will override value from this method.
         */
        getDefaults() {
            return {}
        },
        /**
         * This method should prepare, transform and format data required by submit method
         * @param {Object} data
         */
        prepareData(data) {

        },

        confirmationHandler(task) {
            // This boolean is necessary because materialNote triggers form submit when clicked on dropdown.
            this.submitting = true;
            this.$("form").submit();
        },
        /**
         * @returns {Object} jQuery.validate options object
         */
        getValidateOptions() {
            return {
                ignore: ".note-editable"
            };
        },

        submit() {
            console.warn("Modal form submit method not implemented!");
        },
        addedToDOM() {
            let modalWidgetThis = this;
            this.$el.materialModal({
                ready: modalWidgetThis.modalReady.bind(this),
                complete: modalWidgetThis.destroy.bind(this),
            });
            this.$el.materialModal("open");

            this.$(".materialnote").materialnote({
                toolbar: this.materialnoteToolbar,
                height: 100,
                defaultBackColor: '#fff',
                focus: true
            });
            if (this.edit) {
                this.populateMaterialNote();
            }
            return this._super();
        },
        modalReady() {
            Materialize.updateTextFields();
            if (this.focus) {
                this.$("form " + `[name="${this.focus}"]`).focus();
            }
        },
        renderElement() {
            this._super();
            if (this.edit) {
                this.populateFieldValues();
            }
        },
        populateFieldValues() {
            throw new Error("In order to open modal in edit mode, populateFieldValues should be overriden.");
        },
        populateMaterialNote() {
            throw new Error("In order to open modal in edit mode with materialNote, populateMaterialNote should be overriden.");
        },
        materialnoteToolbar: [
            ['style', ['style', 'bold', 'italic', 'underline', 'strikethrough', 'clear']],
            ['fonts', ['fontsize', 'fontname']],
            ['color', ['color']],
            ['undo', ['undo', 'redo']],
            ['ckMedia', ['ckImageUploader', 'ckVideoEmbeeder']],
            ['misc', ['link', 'table', 'hr', 'codeview', 'fullscreen']],
            ['para', ['ul', 'ol', 'paragraph', 'leftButton', 'centerButton', 'rightButton', 'justifyButton', 'outdentButton', 'indentButton']],
            ['height', ['lineheight']]
        ],
    });

    const NewItemModal = ModalWidget.extend({
        template: "project.agile.widget.modal.new_item",
        focus: "name",
        init(parent, options) {
            this._super(parent, options);
            this.board_id = parseInt(hash_service.get("board"));
            this._require_prop("board_id", "board_id is not set in url");

            if (this.edit) {
                if(!this.edit._is_dataservice){
                    throw new Error ("edit option must be instance of dataservice!")
                }
                this.currentProjectId = this.edit.project_id[0];
                // Just for for consistancy
                if (this.edit.parent_id) {
                    this.parent_id = this.edit.parent_id[0];
                }
            }
        },
        willStart() {
            let superPromise = this._super();
            // Fetch parent item
            if (this.is_sub_item()) {
                return superPromise.then(() => {
                    return DataServiceFactory.get("project.task").getRecord(this.parent_id).then(parent => {
                        this.parent = parent;
                    });
                });
            }
            return superPromise;
        },
        is_sub_item: function () {
            return this.parent_id;
        },
        renderElement() {
            this._super();
            let thisModal = this;
            this.projectMany2one = new Many2One(this, {
                label: "Project",
                model: "project.project",
                field_name: "project_id",
                domain: data.cache.get("current_user").then(user => {
                    return [
                        ["board_ids", "=", this.board_id],
                        ["id", "in", user.team_ids[user.team_id].project_ids],
                    ]
                }),
                changeHandler(evt) {
                    thisModal.currentProjectId = parseInt(evt.target.value);
                    thisModal.projectChanged();
                },
                // Default project in following order of priority: 1. From edit object; 2. from parent; 3. from defaults object;
                default: this.edit && this.edit.project_id ? {id: this.edit.project_id[0], name: this.edit.project_id[1]} :
                    this.parent && this.parent.project_id ? {id: this.parent.project_id[0], name: this.parent.project_id[1]} :
                        this.defaults && this.defaults.project ? this.defaults.project : undefined
            });
            this.projectMany2one.insertBefore(this.$("select[name='type_id']").closest(".input-field"));
        },
        prepareData(task) {
            task.description = this.$(".materialnote").code();
            task.story_points = !!task.story_points ? task.story_points : 0;
            if (this.is_sub_item() && !this.edit && this.$(".add-to-sprint input")[0].checked) {
                task.sprint_id = this.parent.sprint_id ? this.parent.sprint_id[0] : false;
                task.agile_order = this.parent.agile_order + 0.01;
            }
        },
        getValidateOptions() {
            return Object.assign({}, this._super(), {
                rules: {
                    type_id: "required",
                    priority_id: "required",
                    project_id: "required",
                    name: "required",
                    story_points: "number"
                },
                messages: {
                    story_points: _t("Estimate should be in story points (number)")
                }
            });
        },
        submit(task) {
            if (this.is_sub_item() && !this.edit) {
                task.parent_id = this.parent.id;

                // This is quick fix. Controller is called in order to trigger write on parent task.
                // We need this because our web.Syncer is currently unable to send notifications when an One2Many field changes.
                // Hotfix id: e615f5d1-c9df-41a7-85a8-4621fce94ca7
                data.session.rpc('/agile/web/data/task/create_subitem', {task})
                    .then(result => {
                        if (typeof this.afterHook === "function")
                            this.afterHook(result);
                    });
                return;
            }
            if (this.edit) {
                this.edit.write(task).then(result => {
                    if (typeof this.afterHook === "function") {
                        this.afterHook(result);
                    }
                });
            } else {
                data.getDataSet("project.task").create(task).done(id => {
                    task_service.getRecord(id).then(result => {
                        if (typeof this.afterHook === "function") {
                            this.afterHook(result);
                        }
                    });
                });
            }
        },
        start() {
            if (this.currentProjectId) {
                this.projectChanged();
            } else {
                this.prepareSelection({
                    field: "type_id",
                    data: [],
                    mdi: "agile_icon",
                    iconColor: "agile_icon_color",
                });
                this.preparePriority();
            }

            this.$("#create-task").click(this.confirmationHandler.bind(this));
            if (this.is_sub_item() && !this.edit) {
                this.$("#add-task-modal-project").attr("readonly", 1);
                this.$("#new_item_modal_parent_name").val(this.parent.name);
                this.$(".modal-content h4").html("<i class='mdi mdi-subdirectory-arrow-right'/> Add subtask");
                if (!this.parent.sprint_id) {
                    this.$(".add-to-sprint").hide();
                }
            } else {
                this.$(".add-to-sprint").hide();
                this.$(".parent").hide();
            }

            return this._super();
        },
        addedToDOM() {
            if (this.edit) {
                this.$(".materialnote").parent().hide();
            }
            return this._super();
        },
        projectChanged() {
            let thisModal = this;

            $.when(
                DataServiceFactory.get("project.project", true).getRecord(this.currentProjectId),
                data.cache.get("project.type.task_types_priorities", {id: this.currentProjectId})).then((project, result) => {
                Object.assign(this, result);
                this.project = project;
                let allowedTypes = {};
                if (this.parent) {
                    for (let type_id of this.types[this.parent.type_id[0]].type_ids) {
                        allowedTypes[type_id] = this.types[type_id];
                    }
                }
                let selectedType = this.edit ? this.edit.type_id[0] :
                    Object.keys(allowedTypes).length == 1 ? Object.keys(allowedTypes)[0] :
                        this.currentProjectId ? this.project.default_task_type_id[0] : undefined;
                this.prepareSelection({
                    field: "type_id",
                    data: this.parent ? allowedTypes : this.project_types.map(t_id => this.types[t_id]) || [],
                    mdi: "agile_icon",
                    iconColor: "agile_icon_color",
                    selectedValue: selectedType,
                    changeHandler: function () {
                        thisModal.preparePriority(this.value);
                        this.value && thisModal.types[this.value].allow_story_points ?
                            thisModal.$(".estimate").show() :
                            thisModal.$(".estimate").hide();
                    }
                });
                let selectedPriority = this.edit ? this.edit.priority_id[0] : undefined;
                this.preparePriority(selectedType, selectedPriority);
            });

        },
        preparePriority(type_id, priority_id) {
            if (!type_id) {
                this.prepareSelection({
                    field: "priority_id",
                    data: []
                });
                return;
            }
            let prioritiesForType = this.types[type_id].priority_ids.map(key => this.priorities[key]);
            let defaultPriority = priority_id || this.types[type_id].default_priority_id;
            this.prepareSelection({
                field: "priority_id",
                data: prioritiesForType,
                mdi: "agile_icon",
                iconColor: "agile_icon_color",
                selectedValue: defaultPriority
            });
            this.$("form [name=priority_id]").valid();
        },
        populateFieldValues() {
            this.$("input[name=name]").val(this.edit.name.trim());
            this.$("input[name=story_points]").val(this.edit.story_points);
            this.$("#create-task").text("Update");
        },
        populateMaterialNote() {
            this.$(".materialnote").code(this.edit.description);
        }
    });

    const TaskStageConfirmationModal = ModalWidget.extend({
        template: "project.agile.widget.modal.task_stage_confirmation",
        focus: "name",
        init(parent, options) {
            this._super(parent, options);
            this._require_prop("taskId");
            this._require_prop("stageId");
            this._require_prop("stageName");
            this._require_prop("userName");

            // It is possible that the task is unassigned.
            // Q: Should we automatically assign task to the current user when changing state if there is no user defined on task?
            //this._require_prop("userId");
        },
        willStart() {
            return $.when(this._super(), data.cache.get("team_members").then(members => {
                this.members = members;
            }));
        },
        prepareData(confirmation) {
            confirmation.message = this.$(".materialnote").code();
        },
        submit(confirmation, form) {
            let taskId = form.find("#task_id").val();
            data.session.rpc(`/agile/web/data/task/${taskId}/confirm_stage_change`, confirmation).then(result => {
                if (typeof this.afterHook === "function") {
                    this.afterHook(confirmation, form, result);
                }
            });
        },

        start() {
            // TODO: initialize those from qweb template
            this.$("#task_id").val(this.taskId);
            this.$("#stage_id").val(this.stageId);
            this.$("#stage_name").val(this.stageName);
            this.$("#user_name").val(this.userName);

            this.$("#confirm-task-stage").click(this.confirmationHandler.bind(this));
            return this._super();
        }
    });

    const WorkLogModal = ModalWidget.extend({
        _name: "WorkLogModal",
        template: "project.agile.widget.modal.work_log",
        focus: "unit_amount",
        init(parent, options) {
            this._super(parent, options);
            this._require_obj("task", ["id", "name"]);
            this._require_prop("userId");
        },
        prepareData(worklog) {
            worklog.user_id = this.userId;
            worklog.task_id = this.task.id;

            let unit_amount_raw = this.$("#work_log_modal_unit_amount").val();
            try {
                if (unit_amount_raw) {
                    worklog.unit_amount = helpers.time.parse(unit_amount_raw);
                }
            }
            catch (e) {
                console.log(e);
                return;
            }

        },
        submit(worklog) {
            if (this.edit) {
                data.session.rpc(`/agile/web/data/task/${this.task.id}/update_worklog/${this.edit.id}`, {worklogData: worklog})
                    .then(result => {
                        if (typeof this.afterHook === "function")
                            this.afterHook(result);
                    });
            } else {
                data.session.rpc(`/agile/web/data/task/${this.task.id}/create_worklog`, {worklog})
                    .then(result => {
                        if (typeof this.afterHook === "function")
                            this.afterHook(result);
                    });
            }
        },
        renderElement() {
            this._super();
            this.$('#work_log_modal_task_name').val(this.task.name);
            if (!this.edit) {
                this.$('#work_log_modal_date').val(moment().format("YYYY-MM-DD"));
            }
        },
        start() {
            //When unit_amout is changed check if it is valid format and enable/disable submit button.
            this.$("#work_log_modal_unit_amount").change(evt => {
                if (helpers.time.parseOrFalse(evt.target.value)) {
                    this.$("#create-work-log").removeClass("disabled");
                }
                else {
                    this.$("#create-work-log").addClass("disabled");
                }
            });
            if (!this.edit) {
                this.$("#create-work-log").addClass("disabled");
            }
            this.$('.datepicker').pickadate({
                format: 'yyyy-mm-dd',
                selectMonths: true,
                selectYears: 1
            });
            this.$("#create-work-log").click(() => {
                if (this.$("#create-work-log").hasClass("disabled")) {
                    return;
                }
                this.confirmationHandler()
            });
            return this._super();
        },
        addedToDOM() {
            this._super();
            this.$(".unit_amount_help").tooltip({
                tooltip: "Combine: w-weeks, d-days, h-hours, m-minutes. (1 day means 8 hours) Separate with space.",
                position: "left",
            });
        },
        populateFieldValues() {
            this.$('#work_log_modal_date').val(this.edit.date);
            this.$('#work_log_modal_unit_amount').val(this.edit.formated_time);
            this.$('#work_log_modal_name').val(this.edit.name);
            this.$('#create-work-log').text("Update");
        },
        populateMaterialNote() {
        }
    });

    const LinkItemModal = ModalWidget.extend({
        _name: "LinkItemModal",
        template: "project.agile.widget.modal.link_item",
        focus: "relation_id",
        init(parent, options) {
            this._super(parent, options);
            this._require_obj("task", ["id", "key", "name"]);
        },

        willStart() {
            return $.when(this._super(), DataServiceFactory.get("project.task.link.relation").getAllRecords().then(relations => {
                Object.assign(this, {relations});
            }));
        },
        prepareData(link) {
            link.comment = this.$(".materialnote").code();
            link.task_left_id = this.task.id;
        },
        submit(link) {
            data.session.rpc('/agile/web/data/task/create_link', {link})
                .then(result => {
                    if (typeof this.afterHook === "function")
                        this.afterHook(result);
                });
        },
        start() {
            this.prepareSelection({
                field: "relation_id",
                data: this.relations
            });
            this.taskRight = new Many2One(this, {
                label: "With item",
                model: "project.task",
                field_name: "task_right_id",
                domain: this.task_ids ? [["id", "in", this.task_ids]] : data.cache.get("current_user")
                    .then(user => [["id", "!=", this.task_id], ["project_id", "in", user.team_ids[user.team_id].project_ids]])
            });
            this.taskRight.insertAfter(this.$("#task_right_anchor"));

            this.$("#add-link").click(this.confirmationHandler.bind(this));

            return this._super();
        },
        getValidateOptions() {
            return Object.assign({}, this._super(), {
                rules: {
                    relation_id: "required",
                    task_right_id: "required",
                },
            });
        },
    });

    const CommentItemModal = ModalWidget.extend({
        _name: "CommentItemModal",
        template: "project.agile.widget.modal.comment_item",
        init(parent, options) {
            this._super(parent, options);
            this._require_obj("task", ["id", "key", "name"]);
        },
        renderElement() {
            this._super();
            if (this.edit) {
                this.$("#add-comment").text("Update");
                this.$(".modal-content h4").html("<i class='mdi mdi-comment-account'/> Update comment");
            }
        },
        prepareData(comment) {
            comment.body = this.$(".materialnote").code();
        },
        submit(comment) {
            if (!this.edit) {
                data.session.rpc(`/agile/web/data/task/${this.task.id}/add_comment`, {comment})
                    .then(result => {
                        if (typeof this.afterHook === "function")
                            this.afterHook(result[0]);
                    });
            }
            else {
                data.session.rpc(`/agile/web/data/task/${this.task.id}/update_comment/${this.edit.id}`, {comment})
                    .then(result => {
                        if (typeof this.afterHook === "function")
                            this.afterHook(result[0]);
                    });
            }
        },
        start() {
            this.$("#add-comment").click(this.confirmationHandler.bind(this));
            return this._super();
        },
        populateFieldValues() {

        },
        populateMaterialNote() {
            this.$(".materialnote").code(this.edit.body);
        }
    });

    return {
        ModalWidget,
        NewItemModal,
        TaskStageConfirmationModal,
        WorkLogModal,
        LinkItemModal,
        CommentItemModal,
    };
});