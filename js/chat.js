var or,op,ac,orc;

var Chat={

	pending_subscriber:null,
	connection: null,
	on_roster: function(iq){

		or=iq;
		console.log('on-roster',iq);
		$(iq).find('item').each(function(){
			var jid = $(this).attr('jid');
			var name = $(this).attr('name') || jid;
			var jid_id = Chat.jid_to_id(jid);
			var temp =$('<div class="roster-contact offline"></div>').append('<div class="roster-name">' + name + '</div>').append('<div class="roster-jid">' + jid + '</div>');
			var contact = $('<li id="' + jid_id + '"></li>').append(temp);
			Chat.insert_contact(contact);
		});

		Chat.connection.addHandler(Chat.on_presence,null,"presence");
		Chat.connection.send($pres());
	},

	jid_to_id: function(jid){

		return Strophe.getBareJidFromJid(jid)
			.replace(/@/g,'-')
			.replace(/\./g,'-');

	},

	presence_value: function(elem){
		if ($(elem).hasClass('online')){
			return 2;
		} else if($(elem).hasClass('away')){
			return 1;
		}

		return 0;
	},

	insert_contact: function(elem){
		console.log('insert-contact',elem);
		ac=elem;
		var jid=elem.find('.roster-jid').text();
		var pres=Chat.presence_value(elem.find('.roster-contact'));
		var contacts = $('#roster-area li');

		if(contacts.length > 0){
			var inserted = false;
			contacts.each(function(){
				var cmp_pres = Chat.presence_value($(this).find('.roster-contact'));
				var cmp_jid = $(this).find('.roster-jid').text();

				if(pres > cmp_pres){
					$(this).before(elem);
					inserted = true;
					return false;
				} 
				else if(pres === cmp_pres){

					if (jid < cmp_jid){
						$(this).before(elem);
						inserted = true;
						return false;
					}
				}
			});

			if (!inserted){
				$('#roster-area ul').append(elem);
			}

		} else{
			$('#roster-area ul').append(elem);
		}
	},

	on_presence: function(presence){
		console.log('on-presence',presence);
		op=presence;
		
		var ptype = $(presence).attr('type');
		var from = $(presence).attr('from');
		var jid_id=Chat.jid_to_id(from);
		if(ptype){
			console.log(ptype);
		}
		if (ptype === 'subscribe'){
			Chat.pending_subscriber = from;
			$('#approve-jid').text(Strophe.getBareJidFromJid(from));
			$('#approve_dialog').dialog('open');
		} else	if(ptype !== 'error'){
			
			var contact =$('#roster-area li#'+jid_id+' .roster-contact')
			.removeClass("online")
			.removeClass("away")
			.removeClass("offline");
			if(ptype === 'unavailable'){
				contact.addClass("offline");
			} else {

				var show = $(presence).find("show").text();
				if (show === "" || show === "chat"){
					contact.addClass("online");
				} else {
					contact.addClass("away");
				}
			}

			var li = contact.parent();
			li.remove();
			Chat.insert_contact($(li));

		}

		var jid_id = Chat.jid_to_id(from);
		$('#chat-'+ jid_id).data('jid',Strophe.getBareJidFromJid(from));

		return  true;
	},

	on_roster_changed: function(iq){
		console.log('on-roster-change',iq);
		orc=iq;
		$(iq).find('item').each(function(){
			var sub = $(this).attr('subscription');
			var jid = $(this).attr('jid');
			var name= $(this).attr('name') || jid;
			var jid_id = Chat.jid_to_id(jid);

			if (sub === 'remove'){
				$('li[id="' + jid_id + '"]').remove();
			}else{
				var contact_html = "<li id='" + jid_id + "'>" +
					"<div class='" +
					($('#' + jid_id).attr('class') || "roster-contact offline") +
					"'>" +
					"<div class='roster-jid'>" + 
					jid +
					"</div></div></li>"; 
				if ($('#' + jid_id).length > 0)	{
					$('#' + jid_id).replaceWith(contact_html);
				} else{
					Chat.insert_contact($(contact_html));
				}	
			}
		});
	},

	on_message: function(message){
		//var full_jid =$(message).attr('from');
		//var jid = Strophw.getBareJid(full_jid);
		//replace next line with the commented lines for seneing message to only one resource.
		var jid = Strophe.getBareJidFromJid($(message).attr('from'));
		var jid_id = Chat.jid_to_id(jid);

		if( $('div[id="chat-' + jid_id + '"]').length === 0){
			$("<li><a href='#chat-" + jid_id + "'>" + jid + "</a></li>").appendTo('#chat-area .ui-tabs-nav');
			$('#chat-area').append('<div id="chat-'+jid_id+'"></div>');
			$('#chat-area').tabs('refresh');
			//$('#chat-area').tabs('add','#chat-',jid_id, jid);
			$('div[id="chat-' + jid_id + '"]').append(
				"<div class='chat-messages'></div>" +
				"<input type='text' class='chat-input'>");
			//$('#chat-' + jid_id).data('jid',full_jid);
			$('div[id="chat-' + jid_id + '"]').data('jid',jid);
		}
		var index=$('#chat-area a[href="#chat-'+jid+'"]').parent().index();
		
		$('#chat-area').tabs('option','active',index);
		$('div[id="chat-' + jid_id + '"] input').focus();

		var composing =$(message).find('composing');
		if(composing.length > 0){
			$('div[id="chat-' + jid_id + '"] .chat-messages').append(
				"<div class='chat-event'>" +
				Strophe.getNodeFromJid(jid) +
				" is typing...</div>");

			Chat.scroll_chat(jid_id);
		}
		var body = $(message).find("html > body");
		if (body.length === 0){
			body = $(message).find('body');
			if (body.length > 0){
				body = body.text();
			} else {
				body = null;
			}
		} else {
			body = body.contents();

			var span = $("<span></span>");
			body.each(function(){
				if(document.importNode){
					$(document.importNode(this,true)).appendTo(span);
				} else {
					span.append(this.xml);
				}
			});

			body = span;
		}

		if (body){

			$('div[id="chat-' + jid_id + '"] .chat-event').remove();
			$('div[id="chat-' + jid_id + '"] .chat-messages').append(
				"<div class='chat-message'>" +
				"&lt;<span class='chat-name'>" +
				Strophe.getNodeFromJid(jid) +
				"</span>&gt;<span class='chat-text'>"+
				"</span></div>");

			$('div[id="chat-' + jid_id + '"] .chat-message:last .chat-text').append(body);

			Chat.scroll_chat(jid_id);
		}

		return true;
	},

	scroll_chat: function(jid_id){
		var div = $('div[id="chat-' + jid_id + '"] .chat-messages').get(0);
		div.scrollTop = div.scrollHeight;
	}
}

$(document).ready(function(){
	
	$('#login-dialog').dialog({
		autoOpen: true,
		draggable: false,
		modal:true,
		title:'Connect to chat',
		buttons:{
			'Connect':function(){
				$(document).trigger('connect',{
					jid:$('#jid').val(),
					password:$('#password').val()

				});
				$('#password').val('');
				$(this).dialog('close');
			}
		}
	});

	$('#contact_dialog').dialog({
		autoOpen:false,
		draggable:false,
		modal: true,
		title: 'Add a Contact',
		buttons:{
			"Add": function(){
				$(document).trigger('contact_added',{
					jid: $('#contact-jid').val(),
					name: $('#contact-name').val()
				});

				$('#contact-jid').val('');
				$('#contact-name').val('');

				$(this).dialog('close');
			}
		}
	});

	$('#new-contact').click(function(ev){
			$('#contact_dialog').dialog('open');
	});

	$('#approve_dialog').dialog({
		autoOpen: false,
		draggable: false,
		modal: true,
		title: 'Subscription Request',
		buttons: {
			"Deny": function(){
				Chat.connection.send($pres({
					to: Chat.pending_subscriber,
					"type":"unsubscribed"
				}));
				Chat.pending_subscriber = null;
				$(this).dialog('close');
			},
			"Approve": function(){
				Chat.connection.send($pres({
					to: Chat.pending_subscriber,
					"type":"subscribed"
				}));

				Chat.connection.send($pres({
					to:Chat.pending_subscriber,
					"type":"subscribe"}));

				Chat.pending_subscriber = null;
				$(this).dialog('close');
			}
		}
	});

	$('#chat-area').tabs().find('.ui-tabs-nav').sortable({axis:'x'});

	$('.roster-contact').on('click',function(){
		var jid = $(this).find(".roster-jid").text();
		var name = $(this).find(".roster-name").text();
		var jid_id = Chat.jid_to_id(jid);

		if($('div[id="chat-' + jid_id + '"]').length >0){

			var index=$('#chat-area a[href="#chat-'+jid_id+'"]').parent().index();
			$('#chat-area').tabs('option','active',index);
		} else {
			$("<li><a href='#chat-" + jid_id + "'>" + jid + "</a></li>").appendTo('#chat-area .ui-tabs-nav');
			$('#chat-area').append('<div id="chat-'+jid+'"></div>');
			$('#chat-area').tabs('refresh');
			//$('#chat-area').tabs('add','#chat-' + jid_id, name);
			$('div[id="chat-' + jid_id + '"]').append("<div class='chat-messages'></div>" + 
									   "<input type='text' class='chat-input'>");
			$('div[id="chat-' + jid_id + '"]').data('jid',jid);
		}
		$('div[id="chat-' + jid_id + '"] input').focus();
	});

	$(document).on('keypress','.chat-input',function(ev){
		
		var jid =$(this).parent().data('jid');

		if(ev.which === 13){
			ev.preventDefault();

			var body = $(this).val();
			var message =$msg({to: jid,
								"type":"chat"}).c('body').t(body).up().c('active',{xmlns:"http://jabber.org/protocol/chatstates"});

			Chat.connection.send(message);

			$(this).parent().find('.chat-messages').append(
				"<div class='chat-message'>&lt;" + 
				"<span class='chat-name me'>" +
				Strophe.getNodeFromJid(Chat.connection.jid) + 
				"</span>&gt;<span class='chat-text'>" +
				body +
				"</span></div>");

			Chat.scroll_chat(Chat.jid_to_id(jid));

			$(this).val('');

			$(this).parent().data('composing',false);
		} else {
			var composing = $(this).parent().data('composing');
			if (!composing){
				var notify = $msg({to:jid,"type":"chat"})
					.c('composing',{xmlns:"http://jabber.org/protocol/chatstates"});
				Chat.connection.send(notify);
				
				$(this).parent().data('composing',true);	
			}
		}
	});


	$('#disconnect').click(function(){
		Chat.connection.disconnect();
	});

	$('#chat_dialog').dialog({
		autoOpen: false,
		draggable: false,
		modal: true,
		title: true,
		title: 'Start a Chat',
		buttons:{
			"Start":function(){
				var jid = $('#chat-jid').val();
				var jid_id = Chat.jid_to_id(jid);
				$("<li><a href='#chat-" + jid_id + "'>" + jid + "</a></li>").appendTo('#chat-area .ui-tabs-nav');
				$('#chat-area').append('<div id="chat-'+jid_id+'"></div>');
				$('#chat-area').tabs('refresh');
				//$('#chat-area').tabs('add','#chat-' + jid_id, jid);
				$('div[id="chat-' + jid_id + '"]').append("<div class='chat-messages'></div>" +"<input type='text' class='chat-input'>");

				$('div[id="chat-' + jid_id + '"]').data('jid',jid);

				var index=$('#chat-area a[href="#chat-'+jid_id+'"]').parent().index();
  
				$('#chat-area').tabs('option','active',index);

				$('div[id="chat-' + jid_id + '"] input').focus();

				$('#chat-jid').val('');
				Chat.connection.send($pres());
				$(this).dialog('close');
			}
		}
	});

	$('#new-chat').click(function (){
		$('#chat_dialog').dialog('open');
	});
});

$(document).bind('connect',function(ev,data){
	var conn = new Strophe.Connection('http://localhost:5280/http-bind');
	conn.connect(data.jid,data.password,function(status){
		if(status === Strophe.Status.CONNECTED){
			$(document).trigger('connected');
		} else if (status === Strophe.Status.DISCONNECTED){
			$(document).trigger('disconnected');
		}
	});

	Chat.connection = conn;
});


$(document).bind('connected',function(){
	var iq = $iq({type:"get"}).c("query",{xmlns:"jabber:iq:roster"});
	Chat.connection.sendIQ(iq,Chat.on_roster);

	Chat.connection.addHandler(Chat.on_roster_changed,"jabber:iq:roster","iq","set");

	Chat.connection.addHandler(Chat.on_message,null,"message","chat");
});

$(document).bind('disconnected',function(){
	Chat.connection = null;
	Chat.pending_subscriber = null;
	$('#roster-area ul').empty();
	$('#chat-area div').remove();

	$('#login_dialog').dialog('open');
});

$(document).bind('contact_added',function(ev,data){
	
	var iq = $iq({type: "set"}).c("query",{xmlns: "jabber:iq:roster"}).c("item",data);
	
	Chat.connection.sendIQ(iq);

	var subscribe  = $pres({to: data.jid, "type":"subscribe"});
	Chat.connection.send(subscribe);
});
