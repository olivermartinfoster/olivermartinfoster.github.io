define([
  'core/js/adapt'
],function(Adapt) {

  class PageTransition extends Backbone.Controller {

    initialize() {
      /**
       * @type {[ContentObjectView]} Keep a list of all content object views
       */
      this.views = [];
      /**
       * @type {Object} Keep that last scroll state for post animation restoration
       */
      this.lastState = {
        scroll: 0
      };
      /** Keep current scroll position to correct IE11 */
      this.keepScroll = false;
      _.bindAll(this, 'endAnimation', 'updateHash', 'onScroll', 'onPopState');
      this.listenTo(Adapt, "app:dataReady", this.onDataReady);
    }

    onDataReady() {
      const config = Adapt.course.get('_pageTransition');
      if (!config || !config._isEnabled) return;
      this.setupOverrides();
      this.setupEventListeners();
    }

    setupOverrides() {
      // Stop adapt from destroying content object views and scrolling on render
      Adapt.set({
        '_shouldDestroyContentObjects': false,
        '_shouldContentObjectScrollTop': false
      });

      // Switch to history pushState and replaceState to enable popstate event
      Backbone.history._updateHash = this.updateHash;

      // Prevent scroll restoration when returning to a previous page (not supported in IE11)
      history.scrollRestoration = 'manual';

      // Manually prevent scroll restoration for IE11
      window.addEventListener('scroll', this.onScroll, { passive: false, capture: true });
      window.addEventListener('popstate', this.onPopState, { passive: false, capture: true });
    }

    updateHash(location, fragment, replace) {
      // Assume scroll position is always 0 on a new page
      this.lastState = { scroll: 0 };
      history[replace ? 'replaceState' : 'pushState'](this.lastState, '', '#'+fragment);
    }

    onScroll() {
      /**
       * IE11 doesn't support history.scrollRestoration
       * We have to keep the current scroll position of the page being removed
       */
      this.keepScroll = $(window).scrollTop();
      // Save current scroll position for popState restoration
      history.replaceState({
        scroll: $(window).scrollTop()
      }, '', window.location.hash);
    }

    onPopState(e) {
      // Capture scroll position of page being restored
      this.lastState = e.state || { scroll: 0 };
      if (this.keepScroll === false) return;
      /**
       * IE11 doesn't support history.scrollRestoration
       * we have to force the scroll position of the page being removed so that
       * it doesn't jump up
       */
      $(window).scrollTop(this.keepScroll);
    }

    setupEventListeners() {
      // Animation event listeners
      this.listenTo(Adapt, {
        'preRemove': this.onPreRemove,
        'contentObjectView:preRender': this.onContentObjectViewPreRender,
        'contentObjectView:preReady': this.onContentObjectViewPreReady,
        'contentObjectView:postRemove': this.onContentObjectViewPostRemove
      })
    }

    onPreRemove(contentObjectView) {
      if (!contentObjectView) return;
      this.views.push(contentObjectView);
    }

    onContentObjectViewPreRender(contentObjectView) {
      if (this.views.length < 1) return;

      if (this.lastState && this.lastState.scroll !== undefined) {
        // Offset incoming page to match required scroll top
        const scrollTo = this.lastState.scroll - $('.nav').height();
        contentObjectView.$el.css('top', -scrollTo);
      }

      const index = this.views.length;

      // Stop normal contentObject animation behaviour
      contentObjectView.disableAnimation = true;
      contentObjectView.$el.css('opacity', '');

      // Capture view
      this.views.push(contentObjectView);

      // Initialize animation
      contentObjectView.$el.addClass('pagetransition__contentobject__initial');

      // Is this a scroll forward or scroll back?
      const models = [Adapt.course].concat(Adapt.course.getAllDescendantModels(true));
      const previousModel = this.views[index - 1].model;
      const currentModel = contentObjectView.model;
      const previousIndex = models.findIndex(model => model === previousModel);
      const currentIndex = models.findIndex(model => model === currentModel);

      const isScrollForward = (currentIndex >= previousIndex);
      // Add appropriate animation
      if (isScrollForward) {
        contentObjectView.$el.addClass('pagetransition__contentobject__initial__forward');
      } else {
        contentObjectView.$el.addClass('pagetransition__contentobject__initial__backward');
      }

    }

    onContentObjectViewPreReady(contentObjectView) {
      if (this.views.length < 2) return;
      const index = this.views.findIndex(view => view === contentObjectView);
      if (index === -1) return;

      // Holding loading screen
      Adapt.wait.begin();

      // Add incoming animation event listeners and animation classes
      const incomingContentObject = this.views[index];
      incomingContentObject.$el[0].addEventListener('transitionend', this.endAnimation);
      incomingContentObject.$el[0].addEventListener('animationend', this.endAnimation);
      incomingContentObject.$el.addClass('pagetransition__contentobject__start');

      // Add outgoing animation classes
      const outgoingContentObject = this.views[index-1];
      outgoingContentObject.$el.css('transform-origin', `center calc(${$(window).scrollTop()}px + (100vh / 2))`);
      outgoingContentObject.$el.addClass('pagetransition_contentobject__preremove');
      outgoingContentObject.$el.addClass('pagetransition_contentobject__remove');
    }

    endAnimation(event) {
      const index = this.views.findIndex(view => view.$el[0] === event.srcElement);
      if (index === -1) return;

      const incomingContentObject = this.views[index];
      if (!incomingContentObject.$el.hasClass('pagetransition__contentobject__start')) return;

      // Clean up incoming event listeners and animation classes
      incomingContentObject.$el[0].removeEventListener('transitionend', this.endAnimation);
      incomingContentObject.$el[0].removeEventListener('animationend', this.endAnimation);

      // Use raf to stop any perceptible jumping in IE11
      window.requestAnimationFrame(() => {
        // Remove incoming animation classes
        incomingContentObject.$el.removeClass([
          'pagetransition__contentobject__start',
          'pagetransition__contentobject__initial',
          'pagetransition__contentobject__initial__backward',
          'pagetransition__contentobject__initial__forward'
        ].join(' '));

        // Reset incoming scroll
        const scrollTo = (this.lastState && this.lastState.scroll !== undefined) ?
          this.lastState.scroll :
          0;
        $(window).scrollTop(scrollTo);
        incomingContentObject.$el.css('top', '');

        // Release loading screen
        Adapt.wait.end();
      });

      // Destroy outgoing content object
      const outgoingContentObject = this.views[index-1];
      outgoingContentObject.$el.remove();
      _.defer(() => {
        $(window).resize();
        outgoingContentObject.destroy();
      });
    }

    onContentObjectViewPostRemove(contentObjectView) {
      // Remove contentObject views from list
      const index = this.views.findIndex(view => view === contentObjectView);
      this.views.splice(index, 2);
      if (this.views.length) return;
    }

  }

  return new PageTransition();

});
