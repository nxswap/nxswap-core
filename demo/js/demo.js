const { nxswapjs } = NXSwap;
const { NXblockbookAPI } = NXBlockbookAPI;

const nxswap = new nxswapjs();

var currentNetworkA = false;
var currentNetworkB = false;

var addressObjNetworkA = false;
var addressObjNetworkB = false;

var addressNetworkABalance = false;
var addressNetworkBBalance = false;

let defaultNetworkA = "TVTC";
let defaultNetworkB = "TBTC";

let blockbookExplorerURLS = {
	TVTC: "https://tvtc.blockbook.nxswap.com",
	TBTC: "https://tbtc.blockbook.nxswap.com",
	TLTC: "https://tltc.blockbook.nxswap.com"
}

let blockbookNetworkA = false;
let blockbookNetworkB = false;

function copyAtoB () {
	$('.b').html(
		$('.a').html().replace(/a_/g, 'b_' ).replace( 'Blockchain A', 'Blockchain B')
	);
}

function populateNetworkSelection () {
	let networks = nxswap.networks;

	// loop through networks...
	// allow testnet only.. for now

	for( let tick in networks ) {
		let net = networks[tick];
		if( !net.testnet ) {
			delete networks[tick];
		}
	}

	// Empty
	$('#a_networkselect').find('option').remove();
	$('#b_networkselect').find('option').remove();
	// Fill
	for( let ticker in networks ) {
		let network = networks[ticker]
		$('#a_networkselect').append(`<option value='${ticker}'>${ticker}</option>`);
		$('#b_networkselect').append(`<option value='${ticker}'>${ticker}</option>`);
	}
	// Cookies?
	let savedNetworkA = Cookies.get('nxDemoNetworkA');
	let savedNetworkB = Cookies.get('nxDemoNetworkB');
	let selectNetworkA = ( savedNetworkA != undefined ) ? savedNetworkA : defaultNetworkA;
	let selectNetworkB = ( savedNetworkB != undefined ) ? savedNetworkB : defaultNetworkB;
	// Select networks..
	updateNetworkSelection(true,false,selectNetworkA);
	updateNetworkSelection(false,true,selectNetworkB);
	// Enable
	$('#a_networkselect').attr('disabled', false);
	$('#b_networkselect').attr('disabled', false);
}

function updateNetworkSelection( isNetworkA, isNetworkB, newNetwork ) {
	if( ! isNetworkA && ! isNetworkB ) return false;
	if( isNetworkA && isNetworkB ) return false;

	let networkSelection = ( isNetworkA ) ? $('#a_networkselect') : $('#b_networkselect');
	let blockbookNodeField = ( isNetworkA ) ? $('#a_blockbooknode') : $('#b_blockbooknode');
	let showAddressInfo = ( isNetworkA) ? $('#a_show_address') : $('#b_show_address');
	let showTools = ( isNetworkA) ? $('#a_show_tools') : $('#b_show_tools');

	networkSelection.find(`option[value='${newNetwork}']`).attr('selected', true);
	let newBlockbookURL = blockbookExplorerURLS[newNetwork];
	
	if( isNetworkA ) {
		currentNetworkA = newNetwork;
		setCookie('nxDemoNetworkA', newNetwork);
		blockbookNetworkA = false;
		if( newBlockbookURL != undefined ) blockbookNetworkA = new NXblockbookAPI({node: newBlockbookURL});
	} else if( isNetworkB ) {
		currentNetworkB = newNetwork;
		setCookie('nxDemoNetworkB', newNetwork);
		blockbookNetworkB = false;
		if( newBlockbookURL != undefined ) blockbookNetworkB = new NXblockbookAPI({node: newBlockbookURL});
	}

	if( ! newBlockbookURL ) {
		blockbookNodeField.val(`${newNetwork} not supported at the moment.`);
		showAddressInfo.hide();
		showTools.hide();
	} else {
		blockbookNodeField.val(newBlockbookURL);
		showAddressInfo.show();
		showTools.hide();
		loadNetworkAddress(isNetworkA, isNetworkB);
	}
}

function loadNetworkAddress( isNetworkA, isNetworkB ) {
	if( ! isNetworkA && ! isNetworkB ) return false;
	if( isNetworkA && isNetworkB ) return false;

	let currentNetwork = ( isNetworkA ) ? currentNetworkA : currentNetworkB;
	let currentNetworkL = ( isNetworkA ) ? "A" : "B"; 
	let savedAddressWIF = getCookie(`nxDemoAddress-${currentNetworkL}-${currentNetwork}`);
	
	if( ! savedAddressWIF ) {
		// Generate new address..
		let newAddress = nxswap.generateAddress({network: nxswap.networks[currentNetwork]});
		setCookie(`nxDemoAddress-${currentNetworkL}-${currentNetwork}`, newAddress.privWIF);
		savedAddressWIF = newAddress.privWIF;
	}

	if( isNetworkA ) {
		$('#a_address_privWIF').val(savedAddressWIF);
		updateNetworkAddress(true,false,savedAddressWIF);
	} else {
		$('#b_address_privWIF').val(savedAddressWIF);
		updateNetworkAddress(false,true,savedAddressWIF);
	}
}

function updateNetworkAddress ( isNetworkA, isNetworkB, privWIF ) {
	if( ! isNetworkA && ! isNetworkB ) return false;
	if( isNetworkA && isNetworkB ) return false;

	let currentNetworkObject = ( isNetworkA ) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
	let returnObject = nxswap.addressObjectFromWIF( privWIF, currentNetworkObject);

	let showAddressInfo = ( isNetworkA) ? $('#a_show_address') : $('#b_show_address');
	let showTools = ( isNetworkA) ? $('#a_show_tools') : $('#b_show_tools');

	if( isNetworkA ) {
		addressObjNetworkA = returnObject;
		$('#a_address_pub').val('');
	} else {
		addressObjNetworkB = returnObject;
		$('#b_address_pub').val('');
	}

	if( ! returnObject ) {
		showTools.hide();
		if( isNetworkA ) {
			$('#a_address_pub').val('Invalid Private WIF');
		} else {
			$('#b_address_pub').val('Invalid Private WIF');
		}
		return false;
	} else {
		showTools.show();
		if( isNetworkA ) {
			$('#a_address_pub').val(addressObjNetworkA.pub);
			fetchAddressBalance(true,false);
		} else {
			$('#b_address_pub').val(addressObjNetworkB.pub);
			fetchAddressBalance(false,true);
		}
	}
}

async function fetchAddressBalance( isNetworkA, isNetworkB ) {
	if( ! isNetworkA && ! isNetworkB ) return false;
	if( isNetworkA && isNetworkB ) return false;

	let balanceRefreshBut = (isNetworkA) ? $('#a_address_balance_refresh') : $('#b_address_balance_refresh');
	balanceRefreshBut.attr('disabled', true );

	if( isNetworkA ) {
		let balanceA = await blockbookNetworkA.getAddressDetails(addressObjNetworkA.pub).then( function (result) {
			if( result.error ) {
				console.log(result.error);
				$('#a_address_balance').html('Error');
			} else {
				addressNetworkABalance = parseInt(result.balance);
				$('#a_address_balance').html(`${result.balance} (${result.unconfirmedBalance} unconfirmed)`);
			}
		});

	} else {
		let balanceB = await blockbookNetworkB.getAddressDetails(addressObjNetworkB.pub).then( function (result) {
			if( result.error ) {
				console.log(result.error);
				$('#b_address_balance').html('Error');
			} else {
				addressNetworkBBalance = parseInt(result.balance);
				$('#b_address_balance').html(`${result.balance} (${result.unconfirmedBalance} unconfirmed)`);
			}
		})
	}

	balanceRefreshBut.attr('disabled', false );
}

function getCookie(name) {
	let savedCookie = Cookies.get(name);
	if( savedCookie == undefined ) return false;

	// update cookie expiry..
	// temp fix.. woops..
	setCookie(name,savedCookie);

	try {
		let json = JSON.parse(savedCookie);
		return json;
	} catch(e) {
		return savedCookie;
	}
}

function setCookie(name,value) {
	let cookieSecurity = (window.location.hostname == "localhost") ? false : true;
	
	if( typeof(value) === "object" ) {
		value = JSON.stringify(value);
	}

	if( cookieSecurity ) {
		Cookies.set(name, value, { expires: 3000, sameSite: 'strict', secure: true, domain: window.location.hostname} );
	} else {
		Cookies.set(name, value, { expires: 3600 });
	}
}

// Toggle Tool..

function toggleTool (toolID) {
	let toolContent = $(`#${toolID}_content`);
	let toolOpenClose = $(`#${toolID} .openCloseTool`);

	if( toolContent.is(":hidden") ) {
		toolContent.show();
		toolOpenClose.html('close');
	} else {
		toolContent.hide();
		toolOpenClose.html('open');
	}
}

// Bindings...

function bindings () {
	// Select network
	$('#a_networkselect').bind('change', function () {
		if( confirm("Are you sure you want to change network? Your address will be remembered, everything below that will not be!") ) {
			updateNetworkSelection(true,false,$(this).val());
		} else {
			// Revert..
			$('#a_networkselect').val(currentNetworkA);
		}
	});
	$('#b_networkselect').bind('change', function () {
		if( confirm("Are you sure you want to change network? Your address will be remembered, everything below that will not be!") ) {
			updateNetworkSelection(false,true,$(this).val());
		} else {
			// Revert..
			$('#b_networkselect').val(currentNetworkB);
		}
	});
	// Network private key
	$('#a_address_privWIF').bind('change', function () {
		updateNetworkAddress(true,false,$(this).val());
	});
	$('#b_address_privWIF').bind('change', function () {
		updateNetworkAddress(false,true,$(this).val());
	});
	// Refresh balance
	$('#a_address_balance_refresh').bind('click', function () {
		fetchAddressBalance(true,false);
	});
	$('#b_address_balance_refresh').bind('click', function () {
		fetchAddressBalance(false,true);
	});
	// Open Close Tools..
	$('.openCloseTool').each( function () {
		let toolID = $(this).parent().parent().attr('id');
		$(this).bind( 'click', function () {
			toggleTool(toolID);
			return false;
		});
	});
}

$(document).ready( function () {
	copyAtoB();
	populateNetworkSelection();
	bindings();
});

class BaseTool {
	constructor(isNetworkA, isNetworkB) {
    this.init = false;
    this.isNetworkA = isNetworkA;
    this.isNetworkB = isNetworkB;

    if( !isNetworkA && !isNetworkB ) return false;
    if( isNetworkA && isNetworkB ) return false;

		this.aORb = ( isNetworkA ) ? "a" : "b";
    this.init = true;
  }
}

