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
'use strict';
jQuery.fn.getDataFromAncestor = function (dataAttr, oldest = "body") {
    var el = $(this[0]);
    return el.is(oldest) || el.data(dataAttr) !== undefined ? el.data(dataAttr) : el.parent().getDataFromAncestor(dataAttr);
};

$.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function () {
        // convert value to Number if possible
        if (!isNaN(Number(this.value))) {
            this.value = Number(this.value);
        }
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};
$.fn.scrollToElement = function (element, duration = 500) {
    this.animate({
        scrollTop: element.offset().top
        - this.offset().top
        + this.scrollTop()
        - Math.round(this.height() / 2)
        + element.outerHeight()
    }, duration);
};
$.fn.highlight = function () {
    this.css("position", "relative");
    let overlay = $('<div class="overlay agile-main-color"></div>');
    this.append(overlay);
    overlay.animate({opacity: 0.1}, 1000, function () {
        $(this).remove();
    });
};

$.fn.responsive = function () {
    var medias = [
        window.matchMedia('(max-width: 600px)'),
        window.matchMedia('(min-width: 601px) and (max-width: 992px)'),
        window.matchMedia('(min-width: 993px)')
    ];
    var current_class;
    var classes = {
        0: "s",
        1: "m",
        2: "l"
    };

    // Checks which media is matched and returns appropriate class (s/m/l)
    var size_class = () => {
        for (var i = 0; i < medias.length; i++) {
            if (medias[i].matches) {
                return classes[i];
            }
        }
    };

    // Calls rearange if screen class has changed
    var set_size_class = () => {
        var sc = size_class();
        if (sc !== current_class) {
            current_class = sc;
            rearange(sc);
        }
    };

    // Finds all responsive elements and places them after anchor
    // an example of anchor
    // <responsive data-id="1" class="m l"/>
    var rearange = (sc) => {
        this.find(".responsive").each((i, n) => {
            let node = $(n);
            let id = node.data("responsiveId");
            let anchor = this.find(`responsive[data-id=${id}].${sc}`);
            if (anchor.length > 1) {
                throw new Error("Found multiple anchors for responsive jQuery element");
            }
            node.insertAfter(anchor);
        })
    };

    medias.forEach(m => {
        m.addListener(set_size_class);
    });
    rearange(size_class())
};