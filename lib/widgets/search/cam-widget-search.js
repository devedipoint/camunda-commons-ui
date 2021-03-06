define([
  'text!./cam-widget-search.html',
  'angular',
  'jquery'
], function(
  template,
  angular,
  $
) {
  'use strict';

  var dateRegex = /(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:.(\d\d\d)| )?$/;
  function getType(value) {
    if(value && typeof value === 'string' && value.match(dateRegex)) {
      return 'date';
    }
    return typeof value;
  }

  var isValid = function(search) {
    return search.type.value &&
      (!search.extended || search.name.value) &&
      search.operator.value &&
      search.value.value &&
      (getType(search.value.value) === 'date' || !search.enforceDates);
  };

  var validateOperator = function(operator) {
    if(!operator.value) {
      operator.value = operator.values[0];
      return;
    }
    var idx = operator.values.map(function(el) {
      return el.key;
    }).indexOf(operator.value.key);
    operator.value = operator.values[idx === -1 ? 0 : idx];
  };

  var parseValue = function(value) {
    if(!isNaN(value) && value.trim() !== '') {
      // value must be transformed to number
      return +value;
    }
    if(value === 'true') {
      return true;
    }
    if(value === 'false') {
      return false;
    }
    if(value === 'NULL') {
      return null;
    }
    return value;
  };

  return ['$timeout', '$location', 'search',
  function($timeout,   $location,   searchService) {

    return {
      restrict: 'A',

      scope: {
        types: '=camWidgetSearchTypes',
        translations: '=camWidgetSearchTranslations',
        operators: '=camWidgetSearchOperators',

        searches: '=?camWidgetSearchSearches',
        validSearches: '=?camWidgetSearchValidSearches',

        searchId: '@camWidgetSearchId'
      },

      link: function($scope, element) {

        var searchId = $scope.searchId || 'search';

        $scope.searchTypes = $scope.types.map(function(el) {
          return el.id;
        });

        var defaultType = $scope.types.reduce(function(done, type) {
          return done || (type.default ? type : null);
        }, null);

        var getTypes = function() {

          // check which classes are allowed
          var aggregatedTypeKeys = $scope.searches.map(function(el) {
            return el.type.value.key;
          }).reduce(function(aggregatedList, type){
            if(aggregatedList.indexOf(type) === -1) {
              aggregatedList.push(type);
            }
            return aggregatedList;
          }, []);

          var allowedGroups = aggregatedTypeKeys.map(function(el) {
            return getConfigByTypeKey(el).groups;
          }).filter(function(el) {
            return !!el;
          }).reduce(function(groupsArray, groups){
            if(groupsArray){
              if(groupsArray.length === 0) {
                return angular.copy(groups);
              }
              for(var i = 0; i < groupsArray.length; i++) {
                if(groups.indexOf(groupsArray[i]) === -1) {
                  groupsArray.splice(i,1);
                  i--;
                }
              }
              if(groupsArray.length === 0) {
                return null;
              } else {
                return groupsArray;
              }
            } else {
              return null;
            }
          }, []);

          if(allowedGroups === null) {
            return [];
          } else if (allowedGroups.length === 0) {
            return $scope.searchTypes;
          } else {
            return $scope.searchTypes.filter(function(el) {
              var groups = getConfigByTypeKey(el.key).groups;
              if(!groups) return true;
              for(var i = 0; i < groups.length; i++) {
                if(allowedGroups.indexOf(groups[i]) > -1) {
                  return true;
                }
              }
              return false;
            });
          }
        };

        var getConfigByTypeKey = function(typeKey) {
          return $scope.types.reduce(function(done, type) {
            return done || (type.id.key === typeKey ? type : null);
          }, null);
        };

        var getOperators = function(config, value) {
          return config.operators || ($scope.operators[getType(parseValue(value))]);
        };

        var getSearchesFromURL = function() {
          var urlSearches = JSON.parse(($location.search() || {})[searchId+'Query'] || '[]');
          var searches = [];
          angular.forEach(urlSearches, function(search) {
            var config = getConfigByTypeKey(search.type);
            var newSearch =
                {
                  extended: config.extended,

                  type: {
                    values: getTypes(),
                    value: getTypes().reduce(function(done, type) {
                      return done || (type.key === search.type ? type : null);
                    }, null),
                    tooltip: $scope.translations.type
                  },

                  name: {
                    value: search.name,
                    tooltip: $scope.translations.name
                  },

                  operator: {
                    tooltip: $scope.translations.operator
                  },

                  value: {
                    value: search.value,
                    tooltip: $scope.translations.value
                  },
                  allowDates: config.allowDates,
                  enforceDates: config.enforceDates,
                  potentialNames: config.potentialNames || []
                };
            newSearch.operator.values = getOperators(config, newSearch.value.value);
            newSearch.operator.value = newSearch.operator.values.reduce(function(done, op) {
              return done || (op.key === search.operator ? op : null);
            }, null);

            newSearch.valid = isValid(newSearch);
            searches.push(newSearch);
          });
          return searches;
        };

        $scope.searches = $scope.searches || [];
        $scope.searches = getSearchesFromURL();
        $scope.validSearchesBuffer = $scope.searches.reduce(function(valid, search) {
          if(search.valid) {
            valid.push(search);
          }
          return valid;
        }, []);
        $scope.validSearches = angular.copy($scope.validSearchesBuffer);

        var selectNextInvalidElement = function(startIndex, startField) {
          var search = $scope.searches[startIndex];
          if(!search.valid) {
            if(search.extended && !search.name.value && startField !== 'name') {
              search.name.inEdit = true;
              return;
            } else if(startField !== 'value') {
              search.value.inEdit = true;
              return;
            }
          }
          for(var i = 1; i < $scope.searches.length; i++) {
            var idx = (i + startIndex) % $scope.searches.length;
            search = $scope.searches[idx];
            if(!search.valid) {
              if(search.extended && !search.name.value) {
                search.name.inEdit = true;
              } else {
                search.value.inEdit = true;
              }
              return;
            }
          }
        };

        $scope.createSearch = function(type) {
          if(!type && !$scope.inputQuery) {
            return;
          }

          var value = (!type ? $scope.inputQuery : '');

          type = (type && getConfigByTypeKey(type.key)) || defaultType;

          var operators = getOperators(type, value);

          $scope.searches.push({
            extended: type.extended,
            type: {
              values: getTypes(),
              value: type.id,
              tooltip: $scope.translations.type
            },
            name: {
              value: '',
              inEdit: type.extended,
              tooltip: $scope.translations.name
            },
            operator: {
              value: operators[0],
              values: operators,
              tooltip: $scope.translations.operator
            },
            value: {
              value: value,
              inEdit: !type.extended && !value,
              tooltip: $scope.translations.value
            },
            allowDates: type.allowDates,
            enforceDates: type.enforceDates,
            potentialNames: type.potentialNames
          });
          var search = $scope.searches[$scope.searches.length-1];
          search.valid = isValid(search);

          // To those who think, WHAT THE HECK IS THIS?!:
          //
          // Typeahead thinks, it is a good idea to focus the input field after selecting an option via mouse click
          // (see https://github.com/angular-ui/bootstrap/blob/e909b922a2ce09792a733652e5131e9a95b35e5b/src/typeahead/typeahead.js#L274)
          // We do not want this. Since they are registering their focus event per timeout AFTER we register our
          // blur event per timeout, the field is focussed in the end. How to prevent this? More timeouts x_x
          if(!value) {
            $timeout(function(){$timeout(function(){
              $scope.inputQuery = '';
              element.find('.search-container > input').blur();
            });});
          } else {
            $scope.inputQuery = '';
          }
        };

        $scope.deleteSearch = function(idx) {
          $scope.searches.splice(idx,1);
        };

        $scope.handleChange = function(idx, field, before, value, evt) {
          var config;
          var search = $scope.searches[idx];
          if(field === 'type') {
            config = getConfigByTypeKey(value.key);

            search.extended = config.extended;
            search.allowDates = config.allowDates;

            if(!search.enforceDates && config.enforceDates) {
              search.value.value = '';
            }
            search.enforceDates = config.enforceDates;
            search.operator.values = getOperators(config, search.value.value);
            validateOperator(search.operator);
          } else if(field === 'value') {
            if(idx === $scope.searches.length-1) {
              $timeout(function(){
                element.find('.search-container > input').focus();
              });
            }
            config = getConfigByTypeKey(search.type.value.key);
            if(!config.operators) {
              search.operator.values = getOperators(config, search.value.value);
              validateOperator(search.operator);
            }
          }
          search.valid = isValid(search);

          if(evt && evt.keyCode === 13) {
            selectNextInvalidElement(idx, field);
          }

        };

        $scope.onKeydown = function(evt) {
          if(evt.keyCode === 9 && !$scope.inputQuery) {
            evt.preventDefault();
            evt.stopPropagation();
            var search = $scope.searches[evt.shiftKey ? $scope.searches.length-1 : 0];
            if(search) {
              if(evt.shiftKey) {
                search.value.inEdit = true;
              } else {
                search.type.inEdit = true;
              }
            }
          } else if([38,40,13].indexOf(evt.keyCode) !== -1) {
            if(element.find('.dropdown-menu').length === 0) {
              $timeout(function(){
                $(evt.target).trigger('input');
              });
            }
          }
        };

        var extractSearches = function(searches) {
          var out = [];
          angular.forEach(searches, function(search) {
            out.push({
              type: search.type.value.key,
              operator: search.operator.value.key,
              value: search.value.value,
              name: search.name.value
            });
          });
          return out;
        };

        $scope.$watch('searches', function() {
          var searches = $scope.searches;
          // add valid searches to validSearchesBuffer
          angular.forEach(searches, function(search) {
            if(search.valid && $scope.validSearchesBuffer.indexOf(search) === -1) {
              $scope.validSearchesBuffer.push(search);
            }
          });

          // remove invalid searches from valid searches
          angular.forEach($scope.validSearchesBuffer, function(search, idx) {
            if(!search.valid || searches.indexOf(search) === -1) {
              $scope.validSearchesBuffer.splice(idx, 1);
            }
          });

          var queryObj = {};
          queryObj[searchId+'Query'] = JSON.stringify(extractSearches($scope.validSearchesBuffer));
          searchService.updateSilently(queryObj);

          updateSearchTypes();

        }, true);

        var copyValid;
        $scope.$watch('validSearchesBuffer', function() {
          $timeout.cancel(copyValid);
          copyValid = $timeout(function() {
            $scope.validSearches = angular.copy($scope.validSearchesBuffer);
          });
        }, true);

        var updateSearchTypes = function() {
          var types = getTypes();
          $scope.dropdownTypes = types;
          for(var i = 0; i < $scope.searches.length; i++) {
            $scope.searches[i].type.values = types;
          }
        };

        $scope.$watch('types', function() {
          // Currently we only allow to change the potential names of a type, to support changing the filter
          // in the tasklist while preserving existing search queries

          angular.forEach($scope.searches, function(search) {
            search.potentialNames = getConfigByTypeKey(search.type.value.key).potentialNames || [];
          });
        }, true);

        $scope.dropdownTypes = getTypes();

      },

      template: template
    };
  }];
});
