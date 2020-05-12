define([
  'core/js/adapt',
  'core/js/models/menuModel'
], function(Adapt, MenuModel) {

  class InfiniteScroll extends Backbone.Controller {

    initialize() {
      _.bindAll(this, 'onScroll');
      this.listenToOnce(Adapt, {
        "app:dataReady": this.onAppDataReady
      });
    }

    onAppDataReady() {
      const config = Adapt.course.get('_infiniteScroll');
      if (!config || !config._isEnabled) return;
      this.setupEventListeners();
    }

    setupEventListeners() {
      this.listenTo(Adapt, {
        'view:addChild': this.onAddChild
      });
      // Debounce as whilst rendering a lot of _isReady changes occur
      this.listenTo(Adapt.data, 'change:_isReady', _.debounce(this.onReadyChange.bind(this), 40));
      // Make passive as this doesn't need to trigger absolutely
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }

    onAddChild(event) {
      // Never infinite scroll menus
      if (this.isMenu()) {
        return;
      }

      const expectedNextModel = Adapt.parentView.model.getAllDescendantModels(true).find(model => {
        return model.get('_isAvailable') && !model.get('_isRendered');
      });
      if (event.model !== expectedNextModel) {
        // Ensure only the next expected model is rendered
        event.stop();
        return;
      }

      const hasNoChildren = (!event.model.getChildren().length);
      if (hasNoChildren || !event.model.hasManagedChildren) {
        // Always render childless views
        this.listenToOnce(event, 'closed', () => {
          if (event.isStoppedImmediate) return;
          // Adapt.log.debug(`INFINITESCROLL: rendering ${event.model.get('_id')}`);
        });
        return;
      }

      // Stop rendering children immediately if within threshold
      // Otherwise Stop rendering more children until _isReady changes for this child
      const immediate = this.shouldStopLoading();

      if (!immediate) {
        this.listenToOnce(event, 'closed', () => {
          if (event.isStoppedImmediate) return;
          // Adapt.log.debug(`INFINITESCROLL: rendering ${event.model.get('_id')}`);
        });
      }

      event.stop(immediate);
    }

    onReadyChange(model, value) {
      if (!value || this.isMenu()) {
        return;
      }
      Adapt.parentView.addChildren();
    }

    shouldStopLoading() {
      const scrollTop = $(window).scrollTop();
      const windowInnerHeight = $(window).innerHeight();
      const parentHeight = Adapt.parentView.$el.height();
      const remainingParent = (parentHeight - scrollTop);
      const shouldStopLoading = (remainingParent >= windowInnerHeight * 1.5);
      return shouldStopLoading;
    }

    isMenu() {
      return Adapt.parentView && Adapt.parentView.model instanceof MenuModel;
    }

    isReady() {
      return Adapt.parentView && Adapt.parentView.model.get('_isReady');
    }

    onScroll() {
      if (this.isMenu() || !this.isReady() || this.shouldStopLoading()) {
        // Skip scroll events as conditions not met
        return;
      }
      Adapt.parentView.addChildren();
    }

  }

  return Adapt.infiniteScroll = new InfiniteScroll();

});
