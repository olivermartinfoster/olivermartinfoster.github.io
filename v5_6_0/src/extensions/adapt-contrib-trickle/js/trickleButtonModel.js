define([
  'core/js/adapt',
  'core/js/models/componentModel'
], function(Adapt, ComponentModel) {

  class TrickleButtonModel extends ComponentModel {

    init() {
      this.set('_completionAttribute', this.getCompletionAttribute());
      const config = this.getTrickleConfig();
      if (!this.isStepUnlocked() &&
          (!config._stepLocking ||
          !config._stepLocking.isEnabled ||
          config._stepLocking._isCompletionRequired)
        ) {
        return;
      }
      this.setCompletionStatus();
    }

    getCompletionAttribute() {
      var trickle = Adapt.config.get('_trickle');
      if (!trickle) return "_isComplete";
      return trickle._completionAttribute || "_isComplete";
    }

    getTrickleConfig() {
      return Adapt.trickle.getModelConfig(this);
    }

    isStepUnlocked() {
      const completionAttribute = this.getCompletionAttribute();
      return !(this.getSiblings().find(sibling => {
        if (sibling === this.model) {
          return;
        }
        return !sibling.get(completionAttribute);
      }));
    }

    setupStartAndFinalFlags() {
      const parent = this.getParent();
      const parentId = parent.get('_id');
      const siteId = parent.get('_trickleSiteChildId');
      const ancestors = this.getAncestorModels();
      const trickleParent = ancestors.find(model => model.get('_trickleSiteParentId') === siteId);
      const trickleSiblings = trickleParent.getAllDescendantModels(true).filter(model => {
        return model.get('_isAvailable') && model.get('_trickleSiteChildId') === siteId;
      });
      const index = trickleSiblings.findIndex(model => model.get('_id') === parentId);
      this.set({
        _isButtonStart: (index === 0),
        _isButtonFinal: (index === trickleSiblings.length-1 && !trickleParent.get('_canRequestChild'))
      });
    }

    checkIfResetOnRevisit() {
      if (this.isStepUnlocked()) return;
      this.set({
        _isComplete: false,
        _isInteractionComplete: false
      });
    }

  }

  return TrickleButtonModel;


});
