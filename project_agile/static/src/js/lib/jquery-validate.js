/*
##############################################################################
#
# Copyright (c) 2017 Modoolar (http://modoolar.com) All Rights Reserved.
#
# WARNING: This program as such is intended to be used by professional
# programmers who take the whole responsibility of assessing all potential
# consequences resulting from its eventual inadequacies and bugs
# End users who are looking for a ready-to-use solution with commercial
# guarantees and support are strongly advised to contract support@modoolar.com
#
##############################################################################
*/
odoo.define('jquery-validator', function (require) {
    var _t = require('web.core')._t;

    jQuery.validator.setDefaults({
        messages: {
            required: _t("This field is required."),
            remote: _t("Please fix this field."),
            email: _t("Please enter a valid email address."),
            url: _t("Please enter a valid URL."),
            date: _t("Please enter a valid date."),
            dateISO: _t("Please enter a valid date (ISO)."),
            number: _t("Please enter a valid number."),
            digits: _t("Please enter only digits."),
            equalTo: _t("Please enter the same value again."),
            maxlength: $.validator.format(_t("Please enter no more than {0} characters.")),
            minlength: $.validator.format(_t("Please enter at least {0} characters.")),
            rangelength: $.validator.format(_t("Please enter a value between {0} and {1} characters long.")),
            range: $.validator.format(_t("Please enter a value between {0} and {1}.")),
            max: $.validator.format(_t("Please enter a value less than or equal to {0}.")),
            min: $.validator.format(_t("Please enter a value greater than or equal to {0}.")),
            step: $.validator.format(_t("Please enter a multiple of {0}."))
        },
        ignore:"",
        validClass:"",
        errorElement: 'div',
        errorPlacement: function (error, element) {
            var placement = $(element).data('error');
            if (placement) {
                $(placement).append(error)
            } else {
                error.insertAfter(element);
            }
        }
    });
});
