(function (window, document, $, undefined) {
    'use strict';

    var rsthemeJs = {

        m: function (e) {
            rsthemeJs.d();
            rsthemeJs.methods();
        },

        d: function (e) {
            this._window = $(window),
                this._document = $(document),
                this._body = $('body'),
                this._html = $('html')
        },

        methods: function (e) {
            rsthemeJs.customjsActive();
            rsthemeJs.OwlCarousel();
        },

        customjsActive: function () {
            var $ = jQuery;


            //==== Sticky js

            var t = $(".rs-header__main-box"),
                a = $(window);

            a.on("scroll", function () {
                var o = a.scrollTop();
                o < 200 ? t.removeClass("sticky") : t.addClass("sticky");
                $("section").each(function () {
                    o >= $(this).offset().top - $(".rs-header").outerHeight() && $(this).addClass("loaded");
                });
            });


            //==== Offfcanvus Menu 

            $('.off-canver-menu').on('click', function(e) {
                e.preventDefault();
                $('.off-canvas-wrap').addClass('show-off-canvas');
                $('.overly').addClass('show-overly');
            });
            $('.off-canvas-close').on('click', function(e) {
                e.preventDefault();
                $('.overly').removeClass('show-overly');
                $('.off-canvas-wrap').removeClass('show-off-canvas');
            });
            $('.overly').on('click', function(e) {
                $(this).removeClass('show-overly');
                $('.off-canvas-wrap').removeClass('show-off-canvas');
            });
            $(".off-canvas-wrap ul.nav-menu .has-clid > a").click(function (t) {
                t.preventDefault();
                $(this).parent(".has-clid").toggleClass("highlight");
            });


            //===== banner animation slick slider

            function mainSlider() {
                var BasicSlider = $('.rs-banner-slider');
                BasicSlider.on('init', function (e, slick) {
                    var $firstAnimatingElements = $('.rs-banner-3:first-child').find('[data-animation]');
                    doAnimations($firstAnimatingElements);
                });
                BasicSlider.on('beforeChange', function (e, slick, currentSlide, nextSlide) {
                    var $animatingElements = $('.rs-banner-3[data-slick-index="' + nextSlide + '"]').find('[data-animation]');
                    doAnimations($animatingElements);
                });
                BasicSlider.slick({
                    autoplay: true,
                    autoplaySpeed: 4000,
                    dots: false,
                    fade: true,
                    arrows: false,
                    focusOnSelect: false,
                    responsive: [
                        {
                            breakpoint: 1330,
                            settings: {
                                arrows: false
                            }
                        }
                    ]
                });

                function doAnimations(elements) {
                    var animationEndEvents = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
                    elements.each(function () {
                        var $this = $(this);
                        var $animationDelay = $this.data('delay');
                        var $animationType = 'animated ' + $this.data('animation');
                        $this.css({
                            'animation-delay': $animationDelay,
                            '-webkit-animation-delay': $animationDelay
                        });
                        $this.addClass($animationType).one(animationEndEvents, function () {
                            $this.removeClass($animationType);
                        });
                    });
                }
            }
            mainSlider();


            //===== testimonial slick active js

            $('.testi-slider-active').slick({
                slidesToShow: 1,
                slidesToScroll: 1,
                arrows: false,
                asNavFor: '.testi-slider-nav'
            });
            $('.testi-slider-nav').slick({
                slidesToShow: 4,
                slidesToScroll: 1,
                asNavFor: '.testi-slider-active',
                arrows: false,
                dots: false,
                centerMode: false,
                focusOnSelect: true,
            });


            //===== benefit Slick active js

            $('.rs-benefit__slider').slick({
                slidesToShow: 3,
                slidesToScroll: 1,
                arrows: true,
                prevArrow: '<span class="prev"><i class="ri-arrow-left-line"></i></span>',
                nextArrow: '<span class="next"><i class="ri-arrow-right-line"></i></span>',
                dots: false,
                centerMode: true,
                centerPadding: 0,
                responsive: [
                    {
                      breakpoint: 992,
                      settings: {
                        slidesToShow: 2,
                        slidesToScroll: 2,
                      }
                    },
                    {
                      breakpoint: 768,
                      settings: {
                        slidesToShow: 1,
                        slidesToScroll: 1,
                        arrows: false
                      }
                    },
                    {
                      breakpoint: 576,
                      settings: {
                        slidesToShow: 1,
                        slidesToScroll: 1,
                        arrows: false
                      }
                    }
                  ]
            });


            //===== center active js

            var slider = jQuery('.rs-benefit__slider');
            slider.on('init', function (event, slick) {
                slick.$slides.filter('.slick-center').addClass('service-slider-active');
            });
    
            slider.on('mouseenter', '.slick-slide', function () {
                var slide = jQuery(this);
                slider.find('.slick-slide').removeClass('service-slider-active');
                slide.addClass('service-slider-active');
            });
    

            slider.on('mouseleave', function () {
                slider.find('.slick-slide').removeClass('service-slider-active');
                slider.find('.slick-center').addClass('service-slider-active');
            });
    

            slider.on('click', '.slick-dots li', function () {
                slider.find('.slick-slide').removeClass('service-slider-active');
                slider.find('.slick-center').addClass('service-slider-active');
            });
    

            slider.on('click', '.prev, .next', function () {
                slider.find('.slick-slide').removeClass('service-slider-active');
                slider.find('.slick-center').addClass('service-slider-active');
            });


            //==== search popup

            var searchParent = $('.search_icons');
            if (searchParent.length) {
                $(".search_icons").on("click", function () {
                    $(this).toggleClass("open_add_class");
                }); 
            }


            //==== Videos popup jQuery 

            var popupvideos = $('.rs-popup-videos');
            if (popupvideos.length) {
                $('.rs-popup-videos').magnificPopup({
                    disableOn: 10,
                    type: 'iframe',
                    mainClass: 'mfp-fade',
                    removalDelay: 160,
                    preloader: false,
                    fixedContentPos: false
                });
            }


            //====  Progress Bar
            
            if ($(".rs-count-bar").length) {
                $(".rs-count-bar").appear(
                function () {
                    var el = $(this);
                    var percent = el.data("percent");
                    $(el).css("width", percent).addClass("counted");
                }, {
                    accY: -50
                }
                );
            }


            //==== Back To Top js

            $(window).on("scroll", function () {
                var scrollTop = $(window).scrollTop();
                var documentHeight = $(document).height();
                var windowHeight = $(window).height();
                $(".progress-circle").css("stroke-dashoffset", 113.1 - 113.1 * (scrollTop / (documentHeight - windowHeight)));
                if (scrollTop > 150) {
                    $("#scrollUp").fadeIn();
                } else {
                    $("#scrollUp").fadeOut();
                }
            });            
            $("#scrollUp").on("click", function () {
                $("html,body").animate({ scrollTop: 0 }, 500);
            });


            //===== Odometer js

            $('.odometer').appear(function(e) {
                var odo = $(".odometer");
                odo.each(function() {
                    var countNumber = $(this).attr("data-count");
                    $(this).html(countNumber);
                });
            });
            

            //===== accordion js

            $(".accordion_tab").click(function(){
                $(".accordion_tab").each(function(){
                  $(this).parent().removeClass("active");
                  $(this).removeClass("active");
                });
                $(this).parent().addClass("active");
                $(this).addClass("active");
            });

            $(".accordion_tab_2").click(function(){
                $(".accordion_tab_2").each(function(){
                  $(this).parent().removeClass("active");
                  $(this).removeClass("active");
                });
                $(this).parent().addClass("active");
                $(this).addClass("active");
            });


            //===== marquee text js

            $(".marquee_text").data("marquee-loaded") ||
            ($(".marquee_text").each(function () {
                var t = $(this).data("direction"),
                    a = true === $(this).data("hover-pause"),
                    o = false,
                    n = $(this).marquee({ direction: t, duration: $(this).data("duration"), gap: $(this).data("gap"), delayBeforeStart: 0, duplicated: true, startVisible: true, pauseOnHover: a });
                $(this).on("mousedown", function () {
                    o = true;
                    n.marquee("pause");
                    $(this).data("mouse-down", true);
                });
                $(this).on("mouseup", function () {
                    o = false;
                    if (!$(this).data("mouse-dragged")) {
                        n.marquee("resume");
                    }
                    $(this).data("mouse-down", false);
                    $(this).data("mouse-dragged", false);
                });
                $(this).on("mousemove", function () {
                    if (o) {
                        $(this).data("mouse-dragged", true);
                    }
                });
            }),
            $(".marquee_text").data("marquee-loaded", true));


            //===== skillbar Progress js

            $('.skillbar').each(function (index) {
                var skillBar = $(this);

                new Waypoint({
                element: skillBar[0],
                handler: function () {
                    skillBar.skillBars({
                    from: 0,
                    speed: 2000,
                    interval: 100,
                    decimals: 0,
                    });
                    this.destroy();
                },
                offset: 'bottom-in-view',
                });
                skillBar.addClass('waypoint');
            });
            

            //===== Preloader js

            $(window).on( 'load', function() {
                $("#pre-load").delay(300).fadeOut(200);
                $(".pre-loader").on('click', function() {
                    $(".pre-loader").fadeOut(200);
                })
            })


            //===== Range Slider js

            var rangeSlider = function(){
                var slider = $('.range-slider'),
                    range = $('.range-slider__range'),
                    value = $('.range-slider__value');
                  
                slider.each(function(){
              
                  value.each(function(){
                    var value = $(this).prev().attr('value');
                    $(this).html(value);
                  });
              
                  range.on('input', function(){
                    $(this).next(value).html(this.value);
                  });
                });
              };
              
              rangeSlider();


            //===== skeletabs Tabs js

            var skeletabs = $('.rs-tab-active');
            if (skeletabs.length) {
                $('.rs-tab-active').skeletabs({
                    panelHeight: 'adapt',
                    keyboard: 'false',
                });
            }


            //===== wow active js

            if ($('.wow').length) {
                var wow = new WOW({
                    boxClass: 'wow',
                    animateClass: 'animated',
                    offset: 250,
                    mobile: true,
                    live: true
                });
                wow.init();
            }
        
        
            //===== PageScroll2id active js
            
            $(window).on("load", function () {

                $(".rs-header .nav-menu a,a[href='#top'],a[rel='m_PageScroll2id']").mPageScroll2id({
                    highlightSelector: ".rs-header .nav-menu a"
                });
                
                $("a[rel='next']").click(function (e) {
                    e.preventDefault();
                    var to = $(this).parent().parent("section").next().attr("id");
                    $.mPageScroll2id("scrollTo", to);
                });
                
            });
            

        },

        OwlCarousel: function () {
            // OwlCarousel
            $('.rs-carousel').each(function () {
                var owlCarousel = $(this),
                    loop = owlCarousel.data('loop'),
                    items = owlCarousel.data('items'),
                    dotsEach = owlCarousel.data('doteach'),
                    margin = owlCarousel.data('margin'),
                    stagePadding = owlCarousel.data('stage-padding'),
                    autoplay = owlCarousel.data('autoplay'),
                    autoplayTimeout = owlCarousel.data('autoplay-timeout'),
                    smartSpeed = owlCarousel.data('smart-speed'),
                    dots = owlCarousel.data('dots'),
                    nav = owlCarousel.data('nav'),
                    navSpeed = owlCarousel.data('nav-speed'),
                    xsDevice = owlCarousel.data('mobile-device'),
                    xsDeviceNav = owlCarousel.data('mobile-device-nav'),
                    xsDeviceDots = owlCarousel.data('mobile-device-dots'),
                    smDevice = owlCarousel.data('ipad-device'),
                    smDeviceNav = owlCarousel.data('ipad-device-nav'),
                    smDeviceDots = owlCarousel.data('ipad-device-dots'),
                    smDevice2 = owlCarousel.data('ipad-device2'),
                    smDeviceNav2 = owlCarousel.data('ipad-device-nav2'),
                    smDeviceDots2 = owlCarousel.data('ipad-device-dots2'),
                    mdDevice = owlCarousel.data('md-device'),
                    lgDevice = owlCarousel.data('lg-device'),
                    centerMode = owlCarousel.data('center-mode'),
                    HoverPause = owlCarousel.data('hoverpause'),
                    mdDeviceNav = owlCarousel.data('md-device-nav'),
                    mdDeviceDots = owlCarousel.data('md-device-dots');
                    owlCarousel.owlCarousel({
                    loop: (loop ? true : false),
                    dotsEach: (dotsEach ? true : false),
                    // animateIn: 'fadeIn', 
                    // animateOut: 'fadeOut',
                    items: (items ? items : 4),
                    lazyLoad: true,
                    center: (centerMode ? true : false),
                    autoplayHoverPause: (HoverPause ? true : false),
                    margin: (margin ? margin : 0),
                    //stagePadding: (stagePadding ? stagePadding : 0),
                    autoplay: (autoplay ? true : false),
                    autoplayTimeout: (autoplayTimeout ? autoplayTimeout : 1000),
                    smartSpeed: (smartSpeed ? smartSpeed : 250),
                    dots: (dots ? true : false),
                    nav: (nav ? true : false),
                    navText: ["<i class='ri-arrow-left-fill'></i> <span>Prev</span>", "<span>Next</span> <i class='ri-arrow-right-fill'></i>"],
                    navSpeed: (navSpeed ? true : false),
                    responsiveClass: true,
                    responsive: {
                        0: {
                            items: (xsDevice ? xsDevice : 1),
                            nav: (xsDeviceNav ? true : false),
                            dots: (xsDeviceDots ? true : false),
                            center: false,
                        },
                        576: {
                            items: (smDevice2 ? smDevice2 : 2),
                            nav: (smDeviceNav2 ? true : false),
                            dots: (smDeviceDots2 ? true : false),
                            center: false,
                        },
                        768: {
                            items: (smDevice ? smDevice : 3),
                            nav: (smDeviceNav ? true : false),
                            dots: (smDeviceDots ? true : false),
                            center: false,
                        },
                        992: {
                            items: (mdDevice ? mdDevice : 4),
                            nav: (mdDeviceNav ? true : false),
                            dots: (mdDeviceDots ? true : false),
                        },
                        1200: {
                            items: (lgDevice ? lgDevice : 4),
                        }
                    },
                });
            });
        },
    }
    rsthemeJs.m();

})(window, document, jQuery)

