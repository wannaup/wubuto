(function() {
var Agent = Parse.Object.extend("Agent");
var AgentCollection = Parse.Collection.extend({
  	model: Agent
});
var Client = Parse.Object.extend("Client");
var ClientCollection = Parse.Collection.extend({
  	model: Client
});
var Offer = Parse.Object.extend("Offer", {
	changeState: function(s){
		this.set('state', s);
		if (!this.has('states'))
			this.set('states', []);
		this.add('states',{d: new Date(), s: s.id});
	}
});

var OfferCollection = Parse.Collection.extend({
  	model: Offer
});
var OfferState = Parse.Object.extend("OfferState");
var OfferStateCollection = Parse.Collection.extend({
  	model: OfferState
});
var Prod = Parse.Object.extend("Prod");
var ProdCollection = Parse.Collection.extend({
  	model: Prod
});

App = {};

App.Router = Backbone.Router.extend({

        routes: {
        	'offers':'offer_list',
        	'clients':'client_list'
        },

        offer_list: function() {
            App.freeView();
            App.currentView = new OfferListView();
        },

        client_list: function() {
            App.freeView();
            App.currentView = new ClientListView();
        },

        add_offer: function(){
        	var newo = new Offer();
            new OfferModal({
                model: newo
            });
        },

        add_client: function(){
        	var newc = new Client();
            new ClientModal({
                model: newc
            });
        }
});

App.freeView = function() {
        if (App.currentView) {
            App.currentView.remove();
            App.currentView.unbind();
            $('#app').remove();
            $('#maincontent').append('<div id="app">' +
                '<div id="status"><i class="fa fa-spinner fa-spin"></i></div>' +
                '</div>');
        }
    };

    App.freeModal = function() {
        if (App.currentModal !== undefined) {
            App.currentModal.remove();
            App.currentModal.unbind();
            $('#modalspace').remove();
            $('#app').after('<div id="modalspace"></div>');
        }
    };

// And this is the definition of the custom function 
function get_and_render(tmpl_name, tmpl_data) {
    if ( typeof render === "undefined" ) { 
        render={};
        render.tmpl_cache = {};
    }

    if ( ! render.tmpl_cache[tmpl_name] ) {
        var tmpl_dir = '/tpls';
        var tmpl_url = tmpl_dir + '/' + tmpl_name + '.html';

        var tmpl_string;
        $.ajax({
            url: tmpl_url + "?t=" + moment().valueOf(),
            method: 'GET',
            async: false,
            success: function(data) {
                tmpl_string = data;
            }
        });

        render.tmpl_cache[tmpl_name] = Handlebars.compile(tmpl_string);
    }

    return render.tmpl_cache[tmpl_name](tmpl_data);
}

var OfferListView = Parse.View.extend({

	el: "#app",

	events: {
		"click .offer" : "showOffer"
	},

	initialize: function(){
		var me = this;
		this.collection = new OfferCollection();
		this.collection.fetch().done(function(){me.render();});
	},

	render: function(){
		this.$el.html(get_and_render('offer_list', this.collection.toJSON()));
	},

	showOffer: function(e){
		new OfferModal({model: this.collection.get($(e.currentTarget).data('id'))});
		return false;
	}

});

var ClientListView = Parse.View.extend({

	el: "#app",

	events: {
		"click .client" : "showClient"
	},

	initialize: function(){
		var me = this;
		this.collection = new ClientCollection();
		this.collection.fetch().done(function(){me.render();});
		
	},

	render: function(){
		this.$el.html(get_and_render('client_list', this.collection.toJSON()));
	},

	showClient: function(e){
		new ClientModal({model: this.collection.get($(e.currentTarget).data('id'))});
		return false;
	}

});

var ClientModal = Parse.View.extend({

	el: "#modalspace",

	events: {
		"input input" : "setProperty",
		"click #save" : "save"
	},

	initialize: function(){
		this.render();
		var m = this.$el.children().first().modal();
		m.on('hidden.bs.modal', function() {
                App.freeModal();
            });
	},

	render: function(){
		this.$el.html(get_and_render('client_modal', this.model.toJSON()));
	},

	setProperty: function(e){
		this.model.set(e.currentTarget.id, $(e.currentTarget).val());
	},

	save: function(){
		this.model.save(null, { success:function(){
			Backbone.history.loadUrl(Backbone.history.fragment);
		}});
	}

});

var OfferModal = Parse.View.extend({

	el: "#modalspace",

	events: {
		"input input" : "setProperty",
		"input textarea" : "setProperty",
		"select2:select .tochoose": "setChoice",
		"click #save" : "save",
		"click #nxt-state" : "changeState"
	},

	initialize: function(){
		this.render();
		var m = this.$el.children().first().modal();
		m.on('hidden.bs.modal', function() {
                App.freeModal();
            });
	},

	render: function(){
		var me = this;
		this.$el.html(get_and_render('offer_modal', this.model.toJSON()));
		var tochoose = {agents: App.agentcoll, prods: App.prodcoll};
		if (this.model.has('state')){
			var curstate = this.model.get('state');
			curstate.fetch().done(function(){
				var nxtstate = App.ostatecoll.find(function(e){return (e.get('step') == curstate.get('step') + 1)});
				if (nxtstate !== undefined){
					me.$el.find('#nxt-state').html('>>' + nxtstate.get('name')).attr('data-step', nxtstate.get('step')).show();
				}
				else
					me.$el.find('#nxt-state').html(App.ostatecoll.at(App.ostatecoll.length -1).get('name')).attr('disabled','disabled').show();			
			});

		}
		var clis = new ClientCollection();
		clis.fetch().done(function(){
			tochoose.clis = clis;
			for (k in tochoose){
				tochoose[k] = tochoose[k].map(function(o){
					return {id: o.id, text: o.get('name')};
				});
			}
			me.$el.find('.tochoose').each(function(i, e){
			var key = $(e).attr('data-src');
			$(e).select2({
            	data: tochoose[key],
            	minimumResultsForSearch: 10,
        	});
        	$(e).val(me.model.get(e.id)).trigger("change");
		});
		});
	},

	setProperty: function(e){
		this.model.set(e.currentTarget.id, $(e.currentTarget).val());
	},

	setChoice: function(e){
		var obj = null;
		if(e.currentTarget.id == 'client')
			obj = new Client({id: e.currentTarget.value})
		else if(e.currentTarget.id == 'product')
			obj = new Prod({id: e.currentTarget.value})
		else if(e.currentTarget.id == 'agent')
			obj = new Agent({id: e.currentTarget.value})
		this.model.set(e.currentTarget.id, obj);
	},

	changeState: function(e){
		var nxtstate = App.ostatecoll.find(function(el){return el.get('step') == parseInt($(e.currentTarget).data('step'))}); 
		this.model.changeState(nxtstate);
		me.$el.find('#nxt-state').html(nxtstate.get('name')).attr('disabled','disabled');
		return false;
	},

	save: function(){
		if (!this.model.has('state')){
			var zstate = App.ostatecoll.find(function(e){return (e.get('step') == 0)});
			this.model.changeState(zstate);
		}
		this.model.save(null, { success:function(){
			Backbone.history.loadUrl(Backbone.history.fragment);
		}});
	}

});

Parse.initialize("KJyy49GmrLbIC92qISglpVAN6ZnYgHUJ9isQ9DPd", "SF531UTm85mnT5zOwSNS4hOiPdO5jinLlb9TYmBI");

//bind normal navigation to backbone router
App.router = new App.Router();
            Backbone.history.start({
                pushState: true
            });
App.prodcoll = new ProdCollection();
App.agentcoll = new AgentCollection();
App.ostatecoll = new OfferStateCollection();
App.prodcoll.fetch();
App.agentcoll.fetch();
App.ostatecoll.fetch();

            console.log("started");
$(document).on('click', 'a:not([data-bypass])', function(e) {
        href = $(this).prop('href');
        root = location.protocol + '//' + location.host ;
        if (root === href.slice(0, root.length)) {
            e.preventDefault();
            Backbone.history.navigate(href.slice(root.length), true);
        }
    });
$(document).on('click','#addClient', function(e) {
                App.router.add_client();
            });
$(document).on('click','#addOffer',function(e) {
                App.router.add_offer();
            });

})();