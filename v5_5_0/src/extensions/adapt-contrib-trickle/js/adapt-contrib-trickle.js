define([
  'core/js/adapt',
  'core/js/models/contentObjectModel',
  './trickleButton'
], function(Adapt, ContentObjectModel) {

  /**
   * Haven't yet implemented:
   *
   * accessibility
   * _stepLocking._isLockedOnRevisit
   * _button._autoHide
   *
   */

  var Trickle = Backbone.Controller.extend({

    initialize: function() {
      this.listenTo(Adapt, {
        'app:dataLoaded': this.onAppDataReady
      });
    },

    onAppDataReady: function() {
      this.addTrickleComponents();
      this.setupEventListeners();
      this.setupLocking();
    },

    addTrickleComponents: function() {
      const models = Adapt.course.getAllDescendantModels(true);

      const TrickleModel = Adapt.getModelClass('trickle-button');
      let id = 0;

      // Collect all trickle button sites
      const buttonSites = models.reduce((buttonSites, model) => {
        let trickleConfig = this.getModelConfig(model);
        if (!trickleConfig || !trickleConfig._isEnabled) {
          return buttonSites;
        }
        trickleConfig = this.setupTrickleDefaults(model);
        if (trickleConfig._setOnChildren) {
          buttonSites.push({
            id: `site-${id++}`,
            model,
            models: model.getChildren().models
          });
        } else {
          buttonSites.push({
            id: `site-${id++}`,
            model,
            models: [model]
          });
        }
        return buttonSites;
      }, []);

      // Add a component model for each site
      buttonSites.forEach(site => {
        site.model.set('_trickleSiteParentId', site.id);
        site.models.forEach((model, index) => {
          model.set({
            '_isTrickled': true,
            '_trickleSiteChildId': site.id
          });
          const trickleModel = new TrickleModel({
            _id: `trickle-${id++}`,
            _trickleConfigId: site.model.get('_id'),
            _parentId: model.get('_id'),
            _layout: 'full',
            _isAvailable: true,
            _type: "component",
            _component: "trickle-button",
            _displayTitle: "TRICKLE BUTTON",
            _renderPosition: 'outer-append'
          });
          trickleModel.setupModel();
          model.getChildren().add(trickleModel);
        });
      });
    },

    setupTrickleDefaults: function(model) {
      // Setup original trickle configuration with defaults
      const config = Adapt.trickle.getModelConfig(model);
      _.defaults(config, {
        _isEnabled: true,
        _autoScroll: true
      });
      config._button = config._button || {};
      _.defaults(config._button, {
        _isEnabled: true,
        _styleBeforeCompletion: 'hidden',
        _styleAfterClick: 'hidden',
        _isFullWidth: true,
        _autoHide: false,
        _className: '',
        _hasIcon: false,
        text: 'Continue',
        startText: 'Begin',
        finalText: 'Finish',
        _component: 'trickle-button',
        _isVisible: false,
        _isDisabled: false
      });
      config._stepLocking = config._stepLocking || {};
      _.defaults(config._stepLocking, {
        _isEnabled: true,
        _isCompletionRequired: true
      });
      Adapt.trickle.setModelConfig(model, config);
      return config;
    },

    setupEventListeners: function() {
      this.listenTo(Adapt, {
        'contentObjectView:preRender assessment:restored assessments:postReset': this.setupLocking,
        'view:addChild': this.onAddChild
      });
    },

    getCompletionAttribute: function() {
      var trickle = Adapt.config.get('_trickle');
      if (!trickle) return "_isComplete";
      return trickle._completionAttribute || "_isComplete";
    },

    getModelConfig: function(model) {
      const configId = model.get('_trickleConfigId');
      if (configId) {
        const inheritedConfig = Adapt.findById(configId).get('_trickle');
        return $.extend(true, {}, inheritedConfig, model.get('_trickle'));
      }
      return model.get("_trickle");
    },

    setModelConfig: function(model, config) {
      return model.set("_trickle", config);
    },

    setupLocking: function() {
      const models = Adapt.course.getAllDescendantModels(true);

      // Collect all models which many need locking
      // Store in groups as the first item of each group won't be locked
      const lockingGroups = models.reduce((lockingGroups, model) => {
        const trickleConfig = model.get('_trickle');
        if (!trickleConfig || !trickleConfig._isEnabled) {
          return lockingGroups;
        }
        let group;
        if (trickleConfig._setOnChildren) {
          const firstChild = model.getAvailableChildModels()[0];
          if (firstChild) {
            group = this.fetchLockingModels(firstChild);
            lockingGroups.push(group);
          }
        } else {
          group = this.fetchLockingModels(model);
          lockingGroups.push(group);
        }
        if (group) {
          // link the models to their original configuration
          const setId = model.get('_id');
          group.forEach(item => {
            item.set('_trickleConfigId', setId);
          });
        }
        return lockingGroups;
      }, []);

      const locks = {};

      // Collect all locking model initial states, as unlocked
      _.flatten(lockingGroups).forEach(model => {
        locks[model.get('_id')] = locks[model.get('_id')] || {
          id: model.get('_id'),
          model,
          previousState: model.get('_isLocked')
        };
        locks[model.get('_id')].isPrimary = true;
        locks[model.get('_id')].newState = false;
        model.getAllDescendantModels(true).forEach(model => {
          locks[model.get('_id')] = locks[model.get('_id')] || {
            id: model.get('_id'),
            model,
            isPrimary: false,
            previousState: model.get('_isLocked')
          };
          locks[model.get('_id')].newState = false;
        });
        model.set({
          '_isTrickleLocked': true
        });
      });

      const completionAttribute = this.getCompletionAttribute();

      // Calculate new locking state for each locking model
      lockingGroups.forEach(lockingModels => {
        lockingModels.slice(1).forEach((model, previousIndex) => {
          if (locks[model.get('_id')].newState) {
            // Don't unlock anything that was locked in a previous set
            return;
          }
          // Lock according to the completion of the previous item
          const previousLockingModel = lockingModels[previousIndex];
          const config = this.getModelConfig(model);
          const isStepLocked = config && config._stepLocking && config._stepLocking._isEnabled;
          const isLocked = isStepLocked &&
            !previousLockingModel.get(completionAttribute) &&
            !previousLockingModel.get('_isOptional');
          // Lock model after the trickle component
          locks[model.get('_id')].newState = isLocked;
          model.getAllDescendantModels(true).forEach(model => {
            locks[model.get('_id')].newState = isLocked;
          });
        });
      });

      // Apply calculated locks
      const changedLocks = Object.values(locks).filter(lock => lock.previousState !== lock.newState);
      changedLocks.forEach(lock => {
        lock.model.set('_isLocked', lock.newState);
      });
      const addedLockCount = changedLocks.reduce((count, lock) => {
        if (lock.newState) count++;
        return count;
      }, 0);
      const removedLockCount = changedLocks.reduce((count, lock) => {
        if (!lock.newState) count++;
        return count;
      }, 0);

      if (!changedLocks.length) return;

      Adapt.log.debug(`TRICKLE: ${changedLocks.length} locks changed. ${addedLockCount} added, ${removedLockCount} removed.`);

    },

    fetchLockingModels: function(child) {
      const allSiblings = child.getParent().getAvailableChildModels();
      const selfAndSubsequentSiblings = allSiblings.slice(allSiblings.findIndex(sibling => sibling === child));

      const allParents = child.getAncestorModels();
      const inPageParents = allParents.slice(0, allParents.findIndex(parent => parent instanceof ContentObjectModel) + 1);

      const lockingModels = selfAndSubsequentSiblings;
      inPageParents.slice(1).forEach((grandParent, previousIndex) => {
        const parent = inPageParents[previousIndex];
        const allChildren = grandParent.getAvailableChildModels();
        lockingModels.push(...allChildren.slice(allChildren.findIndex(child => child === parent) + 1));
      });

      return lockingModels;
    },

    onAddChild: function(event) {
      if (event.hasRequestChild) {
        this.setupLocking();
      }
      if (!event.model.get('_isTrickleLocked') || !event.model.get('_isLocked')) {
        return;
      }
      event.stop();
    },

    continue: async function() {
      this.setupLocking();
      await Adapt.parentView.addChildren();
      await Adapt.parentView.whenReady();
    },

    scroll: async function(fromModel) {
      var trickle = Adapt.trickle.getModelConfig(fromModel);
      var scrollTo = trickle._scrollTo;
      if (scrollTo === undefined) scrollTo = "@block +1";

      var scrollToId = "";
      switch (scrollTo.substr(0,1)) {
        case "@":
          // NAVIGATE BY RELATIVE TYPE

          // Allows trickle to scroll to a sibling / cousin component
          // relative to the current trickle item
          var relativeModel = fromModel.findRelativeModel(scrollTo, {
            filter: function(model) {
              return model.get("_isAvailable");
            }
          });

          if (relativeModel === undefined) return;
          scrollToId = relativeModel.get("_id");
          break;
        case ".":
          // NAVIGATE BY CLASS
          scrollToId = scrollTo.substr(1, scrollTo.length-1);
          break;
        default:
          scrollToId = scrollTo;
      }

      if (scrollToId == "") return;

      await Adapt.parentView.renderTo(scrollToId);

      $("." + scrollToId).focusOrNext();

      var isAutoScrollOff = (!trickle._autoScroll);
      if (isAutoScrollOff) {
        return false;
      }

      var duration = this.getModelConfig(fromModel)._scrollDuration || 500;
      Adapt.scrollTo("." + scrollToId, { duration: duration });

    }

  });

  return Adapt.trickle = new Trickle();

});
