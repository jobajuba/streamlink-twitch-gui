define( [ "ember" ], function( Ember ) {

	var get = Ember.get;


	/**
	 * @class Parameter
	 * @param {string} arg
	 * @param {(string|Function)?} cond
	 * @param {string?} params
	 * @param {boolean?} subst
	 * @constructor
	 */
	function Parameter( arg, cond, params, subst ) {
		this.arg    = arg;
		this.params = params;
		this.subst  = !!subst;
		this.cond   = cond instanceof Function
			? [ cond ]
			: Ember.makeArray( cond ).concat( params || [] ).map(function( prop ) {
			return function() {
				return !!get( this, prop );
			};
		});
	}


	/**
	 * @class Livestreamer
	 */
	return Ember.Object.extend({
		/** @type {ChildProcess} spawn */
		spawn  : null,
		stream : null,
		channel: null,
		quality: null,
		gui_openchat: null,
		success: false,
		error  : false,
		started: undefined,


		init: function() {
			this.started = new Date();
		},

		kill: function() {
			if ( this.spawn ) {
				this.spawn.kill( "SIGTERM" );
			}
		},

		qualityObserver: function() {
			// The LivestreamerController knows that it has to spawn a new child process
			this.kill();
		}.observes( "quality" ),


		/**
		 * @param {string} str
		 * @returns {string}
		 */
		substitute: function( str ) {
			var self = this;
			var Livestreamer = this.constructor;
			return str.replace( Livestreamer.reSubstitution, function( all, name ) {
				name = name.toLowerCase();
				if ( !Livestreamer.listSubstitution.hasOwnProperty( name ) ) {
					return all;
				}

				var str = get( self, Livestreamer.listSubstitution[ name ] );
				return str
					// escape special characters
					.replace( Livestreamer.reEscape, Livestreamer.strEscape )
					// remove whitespace
					.replace( Livestreamer.reWhitespace, " " )
					.trim();
			});
		},

		/**
		 * @param {LivestreamerController} controller
		 * @returns {string[]}
		 */
		getParametersString: function( controller ) {
			var parameters = [];
			var streamURL  = get( controller, "streamURL" );
			var qualities  = get( controller, "settings.constructor.qualities" );
			var quality    = get( this, "quality" );

			// prepare parameters
			this.constructor.livestreamerParameters.forEach(function( parameter ) {
				// a parameter must fulfill every condition
				var fulfilled = parameter.cond.every(function( cond ) {
					return cond.call( controller );
				});
				if ( !fulfilled ) { return; }

				var params;
				if ( parameter.params === undefined ) {
					params = [];
				} else {
					params = get( controller, parameter.params );
					params = Ember.makeArray( parameter.subst
						? this.substitute( params )
						: params
					);
				}

				// append parameter and its own parameters
				parameters.push.apply( parameters, [ parameter.arg ].concat( params ) );
			}, this );

			// append stream url + quality and return the array
			return parameters.concat([
				streamURL.replace( "{channel}", get( this, "channel.id" ) ),
				( qualities[ quality ] || qualities[ 0 ] ).quality
			]);
		}

	}).reopenClass({
		toString: function() { return "Livestreamer"; },

		/** @property {Parameter[]} livestreamerParameters */
		livestreamerParameters: [
			new Parameter( "--no-version-check" ),
			new Parameter( "--player", null, "settings.player", true ),
			new Parameter( "--player-args", "settings.player", "settings.player_params", true ),
			new Parameter( "--player-passthrough", null, "settings.player_passthrough" ),
			new Parameter( "--player-continuous-http", function() {
				return "http" === get( this, "settings.player_passthrough" )
					&&          !!get( this, "settings.player_reconnect" );
			}),
			new Parameter( "--player-no-close", "settings.player_no_close" ),
			new Parameter( "--twitch-oauth-token", "auth.isLoggedIn", "auth.access_token" )
		],

		reSubstitution  : /\{([a-z]+)}/ig,
		listSubstitution: {
			"name"     : "channel.display_name",
			"channel"  : "channel.display_name",
			"status"   : "channel.status",
			"title"    : "channel.status",
			"url"      : "channel.url",
			"views"    : "channel.views",
			"followers": "channel.followers",
			"delay"    : "channel.delay",
			"game"     : "stream.game",
			"created"  : "stream.created_at",
			"viewers"  : "stream.viewers"
		},

		reEscape : /(["'`$\\])/g,
		strEscape: "\\$1",

		reWhitespace: /\s+/g
	});

});
