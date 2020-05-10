define([
  'core/js/adapt',
  'core/js/views/componentView'
], function(Adapt, ComponentView) {

  var TrickleButtonView = ComponentView.extend({

    allowVisible: false,
    allowEnabled: true,
    popupOpenCount: 0,

    events: {
      "click .js-trickle-btn": "onButtonClick"
    },

    calculateViewState: function() {
      const trickle = this.model.getTrickleConfig();
      const isEnabled = (trickle._isEnabled && trickle._button._isEnabled);

      if (!isEnabled) {
        this.model.set({
          _isEnabled: false,
          _isStepLockingEnabled: false,
          _isStepLockingCompletionRequired: false,
          _isStepUnlocked: false,
          _isButtonComplete: false,
          _isFinished: false,
          _isButtonVisible: false,
          _isButtonDisabled: true
        });
        return;
      };

      const isStepUnlocked = this.model.isStepUnlocked();
      const isButtonComplete = this.model.get('_isComplete');
      const isFinished = (isStepUnlocked && isButtonComplete);

      const isButtonVisibleBeforeCompletion = (trickle._button._styleBeforeCompletion === "visible") &&
        !(trickle._button._autoHide && trickle._button._isFullWidth);
      const isButtonVisibleAfterCompletion = (trickle._button._styleAfterClick !== 'hidden');

      const isButtonVisible = (!isStepUnlocked && isButtonVisibleBeforeCompletion) ||
        (isFinished && isButtonVisibleAfterCompletion) ||
        (isStepUnlocked && !isButtonComplete);

      const isButtonEnabledAfterCompletion = (trickle._button._styleAfterClick !== "disabled");
      const isStepLockingEnabled = (trickle._stepLocking._isEnabled);
      const isStepLockingCompletionRequired = (trickle._stepLocking._isEnabled && trickle._stepLocking._isCompletionRequired);

      const isPopupOpen = Boolean(this.popupOpenCount);

      const isButtonEnabled = !isStepLockingEnabled ||
        !isStepLockingCompletionRequired ||
        (isStepUnlocked && !isButtonComplete && !isPopupOpen) ||
        (isFinished && isButtonEnabledAfterCompletion) ||
        false;

      this.model.set({
        _isEnabled: true,
        _isStepLockingEnabled: isStepLockingEnabled,
        _isStepLockingCompletionRequired: isStepLockingCompletionRequired,
        _isStepUnlocked: isStepUnlocked,
        _isButtonComplete: isButtonComplete,
        _isFinished: isFinished,
        _isButtonVisible: isButtonVisible,
        _isButtonDisabled: !isButtonEnabled
      });

    },

    initialize: function(options) {
      this.model.setupStartAndFinalFlags();
      this.calculateViewState();
      this.render();
      _.defer(this.setReadyStatus.bind(this));
      this.setupEventListeners();
    },

    render: function() {
      var $original = this.$el;
      var data = this.model.toJSON();
      data._trickle = this.model.getTrickleConfig();
      var $newEl = $(Handlebars.templates['trickle-button'](data));
      $original.replaceWith($newEl);
      this.setElement($newEl);
    },

    setupEventListeners: function() {
      if (this.model.get('_isStepLockingCompletionRequired') && !this.model.get('_isComplete')) {
        this.listenTo(Adapt, {
          "popup:opened": this.onPopupOpened,
          "popup:closed": this.onPopupClosed
        });
        const parentModel = this.model.getParent();
        const completionAttribute = this.model.get('_completionAttribute');
        this.listenTo(parentModel, {
          [`bubble:change:${completionAttribute}`]: this.onStepUnlocked,
          [`change:${completionAttribute}`]: this.onButtonComplete
        });
      }
      this.listenTo(Adapt.parentView, {
        "postRemove": this.onRemove
      });
    },

    onStepUnlocked: async function(event) {
      if (event.value === false) return;
      this.calculateViewState();
      if (!this.model.get('_isStepUnlocked')) {
        return;
      }
      const parentModel = this.model.getParent();
      const completionAttribute = this.model.get('_completionAttribute');
      this.stopListening(parentModel, {
        [`bubble:change:${completionAttribute}`]: this.onStepUnlocked
      });
      // Allow for popup open
      _.defer(this.beforeButtonClick.bind(this));
    },

    beforeButtonClick: function() {
      this.updateDOM();
    },

    updateDOM: function() {
      this.calculateViewState();
      this.$('.js-trickle-btn-container').toggleClass('u-display-none', !this.model.get('_isButtonVisible'));
      const isButtonDisabled = this.model.get('_isButtonDisabled');
      const $btn = this.$('.js-trickle-btn');
      $btn.toggleClass('is-disabled', isButtonDisabled);
      if (isButtonDisabled) {
        $btn.attr('disabled', 'disabled');
      } else {
        $btn.removeAttr('disabled');
      }
    },

    onPopupOpened: function() {
      if (!this.model.get('_isStepUnlocked') || this.model.get('_isFinished')) {
        return;
      }
      this.popupOpenCount++;
    },

    onPopupClosed: function() {
      if (!this.model.get('_isStepUnlocked') || this.model.get('_isFinished')) {
        return;
      }
      this.popupOpenCount--;
      this.beforeButtonClick();
      this.stopListening(Adapt, {
        "popup:opened": this.onPopupOpened,
        "popup:closed": this.onPopupClosed
      });
    },

    onButtonClick: function() {
      const trickle = this.model.getTrickleConfig();
      const scrollAfterClick = (trickle._button._styleAfterClick === 'scroll');
      const canScroll = (!this.model.get('_isStepLockingCompletionRequired') ||
        this.model.get('_isComplete'));
      if (scrollAfterClick && canScroll) {
        Adapt.trickle.scroll(this.model);
        return;
      }
      this.model.setCompletionStatus();
    },

    onButtonComplete: async function(model, value) {
      if (!value) {
        return;
      }
      this.afterButtonClick();
      await Adapt.trickle.continue();
      Adapt.trickle.scroll(this.model);
    },

    afterButtonClick: function() {
      this.updateDOM();
    },

    onRemove: function() {
      this.$el.off("onscreen", this.tryButtonAutoHideSync);
      this.remove();
    }

  }, {
    template: 'trickle-button'
  });

  return TrickleButtonView;

});


/**
 * unimplemented parts for _button._autoHide and accessibility
    // setupOnScreenListener: function() {
    //   var trickle = this.model.getTrickleConfig();
    //   if (!trickle._button._autoHide) {
    //     return;
    //   }
    //   this.$el.on("onscreen", this.tryButtonAutoHideSync);
    // },

    // tryButtonAutoHide: function() {
    //   if (!this.allowVisible) {
    //     this.setButtonVisibleState(false);
    //     return;
    //   }

    //   var trickle = this.model.getTrickleConfig();
    //   if (this.popupOpenCount > 0 && trickle._button._styleBeforeCompletion !== 'visible') {
    //     this.setButtonVisibleState(false);
    //     return;
    //   } else if (!trickle._button._autoHide) {
    //     this.setButtonVisibleState(true);
    //     return;
    //   }

    //   var measurements = this.$el.onscreen();

    //   // This is to fix common miscalculation issues
    //   var isJustOffscreen = (measurements.bottom > -100);
    //   // add show/hide animation here if needed
    //   var buttonVisibleState = (measurements.onscreen || isJustOffscreen);

    //   this.setButtonVisibleState(buttonVisibleState);
    // },

  // // move focus forward if it's on the aria-label
  // if (document.activeElement && document.activeElement.isSameNode(this.$('.aria-label')[0])) {
  //   this.$('.aria-label').focusNext();
  // }
  // // make label unfocusable as it is no longer needed
  // this.$('.aria-label').a11y_cntrl(false);

 */
