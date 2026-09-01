// source --> https://baidayi-enterprise.com/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js?ver=10.8.1 
function on_keydown_remove_from_cart(e){" "===e.key&&(e.preventDefault(),e.currentTarget.click())}function focus_populate_live_region(){var e=["woocommerce-message","woocommerce-error","wc-block-components-notice-banner"].map(function(e){return"."+e+'[role="alert"]'}).join(", "),o=document.querySelectorAll(e);if(0!==o.length){var t=o[0];t.setAttribute("tabindex","-1");var n=setTimeout(function(){t.focus(),clearTimeout(n)},500)}}function refresh_sorted_by_live_region(){var e=document.querySelector(".woocommerce-result-count"),o=document.querySelector('[data-wp-interactive="woocommerce/product-filters"]');if(e&&window.location.search&&!o){var t=e.innerHTML;e.setAttribute("role","alert"),e.setAttribute("aria-hidden","true");var n=setTimeout(function(){e.setAttribute("aria-hidden","false"),e.innerHTML="",e.innerHTML=t,clearTimeout(n)},2e3)}}function on_document_ready(){focus_populate_live_region(),refresh_sorted_by_live_region()}jQuery(function(e){e(".woocommerce-ordering").on("change","select.orderby",function(){e(this).closest("form").trigger("submit")}),e("input.qty:not(.product-quantity input.qty)").each(function(){var o=parseFloat(e(this).attr("min"));o>=0&&parseFloat(e(this).val())<o&&e(this).val(o)});var o="store_notice"+(e(".woocommerce-store-notice").data("noticeId")||"");if("hidden"===Cookies.get(o))e(".woocommerce-store-notice").hide();else{function t(o){["Enter"," "].includes(o.key)&&(o.preventDefault(),e(".woocommerce-store-notice__dismiss-link").click())}e(".woocommerce-store-notice").show(),e(".woocommerce-store-notice__dismiss-link").on("click",function n(r){Cookies.set(o,"hidden",{path:"/"}),e(".woocommerce-store-notice").hide(),r.preventDefault(),e(".woocommerce-store-notice__dismiss-link").off("click",n).off("keydown",t)}).on("keydown",t)}e(".woocommerce-input-wrapper span.description").length&&e(document.body).on("click",function(){e(".woocommerce-input-wrapper span.description:visible").prop("aria-hidden",!0).slideUp(250)}),e(".woocommerce-input-wrapper").on("click",function(e){e.stopPropagation()}),e(".woocommerce-input-wrapper :input").on("keydown",function(o){var t=e(this).parent().find("span.description");if(27===o.which&&t.length&&t.is(":visible"))return t.prop("aria-hidden",!0).slideUp(250),o.preventDefault(),!1}).on("click focus",function(){var o=e(this).parent(),t=o.find("span.description");o.addClass("currentTarget"),e(".woocommerce-input-wrapper:not(.currentTarget) span.description:visible").prop("aria-hidden",!0).slideUp(250),t.length&&t.is(":hidden")&&t.prop("aria-hidden",!1).slideDown(250),o.removeClass("currentTarget")}),e.scroll_to_notices=function(o){o.length&&e("html, body").animate({scrollTop:o.offset().top-100},1e3)},e('.woocommerce form .woocommerce-Input[type="password"]').wrap('<span class="password-input"></span>'),e(".woocommerce form input").filter(":password").parent("span").addClass("password-input"),e(".password-input").each(function(){const o=e(this).find("input").attr("id");e(this).append('<button type="button" class="show-password-input" aria-label="'+woocommerce_params.i18n_password_show+'" aria-describedBy="'+o+'"></button>')}),e(".show-password-input").on("click",function(o){o.preventDefault(),e(this).hasClass("display-password")?(e(this).removeClass("display-password"),e(this).attr("aria-label",woocommerce_params.i18n_password_show)):(e(this).addClass("display-password"),e(this).attr("aria-label",woocommerce_params.i18n_password_hide)),e(this).hasClass("display-password")?e(this).siblings(['input[type="password"]']).prop("type","text"):e(this).siblings('input[type="text"]').prop("type","password"),e(this).siblings("input").focus()}),e("a.coming-soon-footer-banner-dismiss").on("click",function(o){var t=e(o.target);e.ajax({type:"post",url:t.data("rest-url"),data:{woocommerce_meta:{coming_soon_banner_dismissed:"yes"}},beforeSend:function(e){e.setRequestHeader("X-WP-Nonce",t.data("rest-nonce"))},complete:function(){e("#coming-soon-footer-banner").hide()}})}),"undefined"==typeof wc_add_to_cart_params&&e(document.body).on("keydown",".remove_from_cart_button",on_keydown_remove_from_cart),e(document.body).on("item_removed_from_classic_cart updated_wc_div",focus_populate_live_region)}),document.addEventListener("DOMContentLoaded",on_document_ready);
// source --> https://baidayi-enterprise.com/wp-content/themes/enfold/js/avia-js.js?ver=7.1.4 
/**
 * Contains plain js basic and helpers classes
 *
 * @since 5.6
 */

/**
 * Global namespace
 *
 * @since 5.6
 */
var aviaJS = aviaJS || {};

(function()
{
	"use strict";

	if( ! aviaJS.aviaJSHelpers )
	{
		class aviaJSHelpers
		{
			constructor()
			{
				this.wpHooks();
			}

			//	based on _.js debounce()
			debounce( callback, wait, immediate )
			{
				var timeout;

				return function()
				{
					var context = this,
						args = arguments;

					var later = function()
					{
						timeout = null;
						if( ! immediate )
						{
							callback.apply(context, args);
						}
					};

					var callNow = immediate && ! timeout;

					clearTimeout( timeout );
					timeout = setTimeout( later, wait );
					if( callNow )
					{
						callback.apply( context, args );
					}
				};
			}

			wpHooks()
			{
				//	to avoid checking for wp.hooks calling filters or actions we create dummy functions here
				if( window['wp'] && wp.hooks )
				{
					return;
				}

				if( ! window['wp'] )
				{
					window['wp'] = { hooks: {} };
				}
				else
				{
					window['wp'].hooks = {};
				}

				let obj = window['wp'].hooks;

				obj.applyFilters = this.wpHooks_applyFilters;
				obj.doAction = this.wpHooks_applyFilters;
				obj.hasFilter = this.wpHooks_hasFilters;
				obj.hasAction = this.wpHooks_hasFilters;
			}

			wpHooks_applyFilters( handle, value )
			{
				return value;
			}

			wpHooks_hasFilters( handle, namespace )
			{
				return false;
			}
		}

		aviaJS.aviaJSHelpers = new aviaJSHelpers();
	}

	if( ! aviaJS.aviaPlugins )
	{
		class aviaPlugins
		{
			plugins = [];
			defaultPlugin = {
				classFactory:	null,
				selector:		''
			};

			constructor()
			{
				this.plugins = [];
			}

			register( classFactory, selector )
			{
				if( 'function' != typeof classFactory )
				{
					return false;
				}

				let newPlugin = Object.assign( {}, this.defaultPlugin );

				if( 'string' != typeof selector )
				{
					selector = 'body';
				}

				newPlugin.classFactory = classFactory;
				newPlugin.selector = selector;

				this.plugins.push( newPlugin );

				this.check_bind();
			}

			check_bind()
			{
				if( document.readyState === 'complete' )
				{
					// The page is already fully loaded
					this.bind_plugins();
				}
				else
				{
					document.addEventListener( 'readystatechange', this.bind_plugins.bind( this ) );
				}
			}

			bind_plugins( e )
			{
				if( document.readyState !== 'complete' )
				{
					return;
				}

				let plugins = this.plugins;
				this.plugins = [];

				for( let plugin of plugins )
				{
					let elements = document.querySelectorAll( plugin.selector );

					for( let element of elements )
					{
						plugin.classFactory( element );
					}
				}
			}
		}

		aviaJS.aviaPlugins = new aviaPlugins();
	}

})();
// source --> https://baidayi-enterprise.com/wp-content/themes/enfold/js/avia-compat.js?ver=7.1.4 
/*
	this prevents dom flickering for elements hidden with js, needs to be outside of dom.ready event.also adds several extra classes for better browser support
	this is a separate file that needs to be loaded at the top of the page. other js functions are loaded before the closing body tag to make the site render faster
*/
"use strict";

var avia_is_mobile = false;
if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 'ontouchstart' in document.documentElement)
{
	avia_is_mobile = true;
	document.documentElement.className += ' avia_mobile ';
}
else
{
	document.documentElement.className += ' avia_desktop ';
}

document.documentElement.className += ' js_active ';

(function()
{
	//set transform property
	var prefix = [ '-webkit-', '-moz-', '-ms-', '' ],
		transform = '',
		transform2d = false,
		transform3d = false;

	for( var i in prefix )
	{
		// http://artsy.github.io/blog/2012/10/18/so-you-want-to-do-a-css3-3d-transform/
		if( prefix[i] + 'transform' in document.documentElement.style )
		{
			transform2d = true;
			transform = prefix[i] + 'transform';
		}

		if( prefix[i] + 'perspective' in document.documentElement.style )
		{
			transform3d = true;
		}
	}

	if( transform2d )
	{
		document.documentElement.className += ' avia_transform ';
	}

	if( transform3d )
	{
		document.documentElement.className += ' avia_transform3d ';
	}

	//set parallax position to prevent jump at pageload
	if( typeof document.getElementsByClassName == 'function' && typeof document.documentElement.getBoundingClientRect == "function" && avia_is_mobile == false )
	{
		if( transform && window.innerHeight > 0 )
		{
			setTimeout( function()
			{
				var y = 0,
					offsets = {},
					transY = 0,
					parallax = document.getElementsByClassName( "av-parallax" ),
					winTop = window.pageYOffset || document.documentElement.scrollTop;

				for( y = 0; y < parallax.length; y++ )
				{
					parallax[y].style.top = "0px";
					offsets	= parallax[y].getBoundingClientRect();
					transY	= Math.ceil( (window.innerHeight + winTop - offsets.top) * 0.3 );
					parallax[y].style[transform] = "translate(0px, " + transY + "px)";
					parallax[y].style.top = "auto";
					parallax[y].className += ' enabled-parallax ';
				}
			}, 50);
		}
	}
})();