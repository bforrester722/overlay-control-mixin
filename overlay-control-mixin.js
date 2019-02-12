
import {listen, schedule} from '@spriteful/utils/utils.js';


export const SpritefulOverlayControlMixin = superClass => {
  return class SpritefulOverlayControlMixin extends superClass {
  	
	  static get properties() {
	    return {
	    	// keep track of all overlays and their scroll positions
	      // since we are only using one scroller (thanks Safari)
	      _overlayRegistry: {
	        type: Object,
	        value: () => ({})
	      }

	    };
	  }
	  

	  connectedCallback() {
	  	super.connectedCallback();
	  	// setup overlay controller with app-shell as the first element
	    const symbol = Symbol();
	    this._overlayRegistry = {
	      sequence: [symbol],
	      [symbol]: {
	        header:         	 this.$.header,
	        content:        	 this.$.pages,
	        contentPos:     	 0,
	        headerPos:      	 0,
	        layout:         	 this.$.layout,
	        panel:          	 this.select('#app-shell-main-panel'),
	        scrollTravel:   	 0,
	        underHeaderSticky: this.$.underHeaderStickySlot,
	        underlaySymbol: 	 null
	      }
	    };

	  	listen(this, 'overlay-preparing-to-open', 				 this.__overlayPreparingToOpen.bind(this));
	    listen(this, 'overlay-opened',            				 this.__overlayOpened.bind(this));
	    listen(this, 'overlay-preparing-to-exit', 				 this.__overlayPreparingToExit.bind(this));
	    listen(this, 'overlay-exiting',           				 this.__overlayExiting.bind(this));
	    listen(this, 'overlay-reset',             				 this.__overlayReset.bind(this));
	    listen(this, 'overlay-controller-reset-underlays', this.__resetUnderlays.bind(this));
	  }


	  __addItemToRegistrySequence(symbol) {
	  	this._overlayRegistry.sequence.push(symbol);
	  }


	  __getUnderlaySymbolFromRegistry() {
	  	const sequence         = this._overlayRegistry.sequence.length - 1;
      const underlaySequence = sequence - 1;
      const underlaySymbol   = this._overlayRegistry.sequence[underlaySequence];
      return underlaySymbol;
	  }


	  __itemRegistered(symbol) {
	  	return Boolean(this.__getItemFromRegistry(symbol));
	  }


	  __getItemFromRegistry(symbol) {
	  	return this._overlayRegistry[symbol];
	  }


	  __makeRegistryItem(event) {
	  	const {node}                    = event.detail;
	    const {content, header, symbol} = node;
	    const underlaySymbol = this.__getUnderlaySymbolFromRegistry();
	    const item 					 = {
    		content,
    		contentPos:  0,
    		firstOpen: 	 true,
    		header, 
        headerPos:   0,
    		layout: 		 node.$.layout, 
    		panel:  		 node,
    		resetScroll: node.resetScroll,
    		symbol,
    		underlaySymbol
    	};
    	return item;
	  }


	  __addItemToRegistry(event) {
	  	const item = this.__makeRegistryItem(event);
      this._overlayRegistry[item.symbol] = item;
	  }


	  __updateItemInRegistry(symbol) {
	  	const underlaySymbol 	 = this.__getUnderlaySymbolFromRegistry();
	  	const overlay 			 	 = this.__getItemFromRegistry(symbol);
	  	overlay.underlaySymbol = underlaySymbol;
	  }


	  __getOverlays(event) {
	  	const {symbol, header} = event.detail.node;
	    if (!header) { return; } // not an event from a header overlay

	  	if (this.__itemRegistered(symbol)) {
	  		this.__updateItemInRegistry(symbol);
	  	}
	  	else {
	    	this.__addItemToRegistry(event);
	  	}
	  	
    	const overlay  = this.__getItemFromRegistry(symbol);
      const underlay = this.__getItemFromRegistry(overlay.underlaySymbol);
      return {overlay, underlay};
	  }


	  __removeOverlayFromRegistrySequence() {
	  	this._overlayRegistry.sequence.pop();
	  }


	  __cacheHeaderAndContentPositions(element) {
	  	const {top}        = element.header.getScrollState();
	    element.headerPos  = top;
	    element.contentPos = window.pageYOffset;
	    return element;
	  }


	  __disableHeader(element) {
	  	element.header.disabled = true;
	    element.header.toggleScrollListener(false);
	    return element;
	  }


	  __setupAndPlaceOverlay(overlay, underlay) {
	  	overlay.content.style.display = 'block';
	  	overlay.header.style.opacity  = '1';
	    overlay.content.style.opacity = '0';
	    overlay.panel.style.top 			= `${underlay.contentPos}px`;
	    return overlay;
	  }


	  __prepForResetScroll(overlay) {
	  	const toolbars = Array.from(overlay.header.querySelectorAll('app-toolbar'));
    	toolbars.forEach(toolbar => {
    		toolbar.style.opacity = '0';
    	});
	    overlay.header.style.transform = '';
	    overlay.panel.resetHeaderParallaxContainer();
	  }


	  __placeHeaderAndContent(overlay) {
	  	overlay.header.style.transform = 
	      `translateY(${-overlay.headerPos}px)`;
	    overlay.content.style.transform = 
	      `translateY(${-overlay.contentPos}px)`;
	  }


	  __resetOverlayScrollPosition(overlay) {
	  	overlay.panel.resetHeaderParallaxContainer();
    	overlay.header.resetLayout();
    	overlay.header.notifyResize();
    	overlay.header.scroll({
    		left: 		 0, 
    		top: 			 0, 
    		behavior: 'silent' // Polymer specific app header val
    	});
	  }


	  __setLayoutElToPreviousScrollPosition(element) {
	  	element.content.style.transform = '';
    	element.header.style.transform  = 
      	`translateY(${-element.headerPos}px)`; // cached scroll pos correction
    	element.header.scroll({
    		left: 		 0, 
    		top: 			 element.contentPos, 
    		behavior: 'silent'
    	});
	  }


	  __hideLayoutElement(element) {
	  	element.header.style.opacity  = '0';	    
	    element.content.style.opacity = '0'; // ios flicker workaround
	    element.content.style.display = 'none';
	    if (element.underHeaderSticky) {
	    	const {id} 			 = element.underHeaderSticky;
	    	const slottedEls = this.slotNodes(`#${id}`);
	    	slottedEls.forEach(el => {
	    		el.style.display 		= 'none';
	    		el.style.opacity 		= '0';
	    		el.style.transition = '';
	    	});
	    }
	  }


	  __resetOverlayToTop(overlay) {	  	
	    overlay.panel.style.top = '0px';
	  }


	  __iosContentFix(overlay) {	  	
	    // safari content pos fix IMPORTANT
	    // the bug appears when you scroll current content down all the way
	    // then open an overlay, content is not where it should be without this fix
	    overlay.layout.resetLayout(); 
	  }


	  __showResetToolbars(overlay) {
	  	const toolbars = 
	  		Array.from(overlay.header.querySelectorAll('app-toolbar'));
    	toolbars.forEach(toolbar => {
    		toolbar.style.transition = 'opacity 0.2s ease-in';
    		toolbar.style.opacity 	 = '1';
    	});
	  }


	  __readyLayoutElement(element) {
	  	element.content.style.opacity = '1'; // safari workaround
	    element.header.disabled 			= false;
	    element.header.toggleScrollListener(true);
	    if (element.underHeaderSticky) {
	    	const {id} 			 = element.underHeaderSticky;
	    	const slottedEls = this.slotNodes(`#${id}`);
	    	slottedEls.forEach(el => {
	    		el.style.transition = 'opacity 0.1s ease-in';
	    		el.style.opacity 		= '1'
	    	});
	    }
	  }


	  __setupUnderlayForDisplay(underlay, overlay) {
	  	underlay.content.style.display 	 = 'block';
	    underlay.header.style.opacity  	 = '1';
	    underlay.content.style.transform = 
	      `translateY(${overlay.contentPos - underlay.contentPos}px)`;
      if (underlay.underHeaderSticky) {
	    	const {id} 			 = underlay.underHeaderSticky;
	    	const slottedEls = this.slotNodes(`#${id}`);
	    	slottedEls.forEach(el => el.style.display = 'block');
	    }
	  }


	  async __counteractAnimationHeaderPlacement(overlay) {
	  	overlay.header.style.transform = 
	      `translateY(${-overlay.headerPos}px)`;
	    await schedule();
	    overlay.header.style.transform = 
	      `translateY(${overlay.contentPos - overlay.headerPos}px)`;
	  }


	  async __overlayPreparingToOpen(event) {	 
	  	const {header, symbol} = event.detail.node;
	  	if (!header) { return; } // not an event from a header overlay
	  	this.__addItemToRegistrySequence(symbol); 	
	  	const {overlay, underlay} = this.__getOverlays(event);
	    const cachedUnderlay 			= this.__cacheHeaderAndContentPositions(underlay);
	    const disabledUnderlay 		= this.__disableHeader(cachedUnderlay);
	    const disabledOverlay 		= this.__disableHeader(overlay);
	    const placedOverlay 		 	= this.__setupAndPlaceOverlay(disabledOverlay, disabledUnderlay);
	    await schedule();
	    if (placedOverlay.firstOpen || placedOverlay.resetScroll) {
	    	placedOverlay.header.resetLayout();
	    	placedOverlay.header.notifyResize();
	    	placedOverlay.firstOpen = false;
	    }
	    await schedule();
	    if (placedOverlay.resetScroll) {
	    	this.__prepForResetScroll(placedOverlay);
	    }
	    else {
	    	this.__placeHeaderAndContent(placedOverlay);
	    }
	  }


	  async __overlayOpened(event) {
	    const overlays = this.__getOverlays(event);
	  	if (!overlays) { return; } // not a header overlay
	  	const {overlay, underlay} = overlays;
	    if (overlay.resetScroll) {
	    	this.__resetOverlayScrollPosition(overlay);
	    }
	    else {
	    	this.__setLayoutElToPreviousScrollPosition(overlay);
	    }	    
	    this.__hideLayoutElement(underlay);
	    this.__resetOverlayToTop(overlay);
	    this.__iosContentFix(overlay);
	    await schedule();
	    if (overlay.resetScroll) {
		    this.__showResetToolbars(overlay);
	    }
	    this.__readyLayoutElement(overlay);
	  }


	  __overlayPreparingToExit(event) {
	    const overlays = this.__getOverlays(event);
	  	if (!overlays) { return; } // not a header overlay
	  	const {overlay, underlay} = overlays;
	  	const cachedOverlay = this.__cacheHeaderAndContentPositions(overlay);
	  	this.__disableHeader(cachedOverlay);
	  	this.__setupUnderlayForDisplay(underlay, overlay);	    
	  }


	  __overlayExiting(event) {
	    const overlays = this.__getOverlays(event);
	  	if (!overlays) { return; } // not a header overlay
	  	const {overlay} = overlays;
	  	if (overlay.resetScroll && overlay.contentPos === 0) { return; }
	    this.__counteractAnimationHeaderPlacement(overlay);
	  }


	  async __overlayReset(event) {
	  	if (event.detail.type === 'controller-reset') { return; }
	    const overlays = this.__getOverlays(event);
	  	if (!overlays) { return; } // not a header overlay
	  	const {overlay, underlay} 			= overlays;
	  	this.__hideLayoutElement(overlay);
	  	this.__setLayoutElToPreviousScrollPosition(underlay);
	    await schedule();
	    this.__readyLayoutElement(underlay);
	    this.__removeOverlayFromRegistrySequence();
	  }
	  // for use when a workflow should end and start user off at beginning
	  // instead of forcing user to maually back out off the workflow
	  // ie. 'continue shopping' circumstance
	  __resetUnderlays() {
	  	// reset all overlays back to spriteful-app-shell
  		// get all symbols besides the one for spriteful-app-shell's header
  		const sequence 				= this._overlayRegistry.sequence;
  		const lastIndex 			= sequence.length - 1;
  		const underlaySymbols = sequence.slice(1, lastIndex);
  		const newSequence 		= [sequence[0], sequence[lastIndex]];
  		const underlays 			= underlaySymbols.map(symbol => 
  															this.__getItemFromRegistry(symbol));
  		// reset underlays that are between base view and uppermost overlay
  		underlays.forEach(underlay => {
  			underlay.panel.reset('controller-reset');
  		});
  		// reset sequence to include only the base view and uppermost overlay symbols
  		this._overlayRegistry.sequence = newSequence;
	  }

	};
};
