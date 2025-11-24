/* Description: Custom JS file */

(function ($) {
    "use strict";

    /* Navbar Scripts */
    // Collapse navbar on scroll
    $(window).on('scroll load', function () {
        if ($(".navbar").offset().top > 60) {
            $(".fixed-top").addClass("top-nav-collapse");
        } else {
            $(".fixed-top").removeClass("top-nav-collapse");
        }
    });

    // Smooth scrolling (requires jQuery Easing)
    $(function () {
        $(document).on('click', 'a.page-scroll', function (event) {
            var $anchor = $(this);
            $('html, body').stop().animate({
                scrollTop: $($anchor.attr('href')).offset().top
            }, 600, 'easeInOutExpo');
            event.preventDefault();
        });
    });

    // Offcanvas behavior for small screens
    // Only trigger from the navbar toggle button
    $('.navbar-toggler').on('click', function () {
        $('.offcanvas-collapse').toggleClass('open');
    });

    // When clicking a nav link (except dropdown toggles), close the menu
    $('.navbar-nav li a:not(.dropdown-toggle)').on('click', function () {
        $('.offcanvas-collapse').removeClass('open');
    });


    /* Move Form Fields Label When User Types */
    $("input, textarea").keyup(function () {
        if ($(this).val() !== '') {
            $(this).addClass('notEmpty');
        } else {
            $(this).removeClass('notEmpty');
        }
    });

    /* Back To Top Button */
    $('body').prepend('<a href="body" class="back-to-top page-scroll">Back to Top</a>');
    var amountScrolled = 700;

    $(window).scroll(function () {
        if ($(window).scrollTop() > amountScrolled) {
            $('a.back-to-top').fadeIn('500');
        } else {
            $('a.back-to-top').fadeOut('500');
        }
    });

    /* Removes Long Focus On Buttons */
    $(".button, a, button").mouseup(function () {
        $(this).blur();
    });

})(jQuery);
