/**
 * @description generate effects according to x-component-prop in schema
 */
import { isEmpty } from '@uform/shared';

import { Schema } from '../shared/schema'

// static configurations
const EXPRESSION_OPERATORS = [
  '!', '=', '==', '===', '!=', '!==', '&', '&&', '?', ':', '>', '<', '>=', '<=', // logical operators
  '/', '*', '+', '-', '%' // arithmetic operators
]

// transfer into RegExp obj
const EXPRESSION_ILLEGAL_TEST = (() => {
  let ruleBody = EXPRESSION_OPERATORS.map((r) => {
    return `\\s*\\${r}\\s*`;
  })
  return new RegExp(`(${ruleBody.join('|')})`, 'g');
})()

// current setting: one string only allow one expression
const EXPRESSION_SIGN = {
  // use by ExgExp
  start: '\\{\\{',
  end: '\\}\\}'
}

const EXPRESSION_EXTRACT = (() => {
  const { start, end } = EXPRESSION_SIGN
  return new RegExp(`${start}([^\\{\\}]+)${end}`); // add ^ and $
})();
const IS_EXPRESSION_EXTRACT = EXPRESSION_EXTRACT;

// current setting: root
const EXPRESSION_VARIABLES_EXTRACT = /root\.([\.\d\w]+)/ig;
/**
 * @return { subscribeName: [], subscribeParams: [] }
 * @description root.value.email !== "" && root.value.username !== ""
 * @description
 */
function precomplieExpression(expressionStr) {
  let complieResult: Array<{
    subscribeName: string,
    subscribeParams: { expressStrPiece: string, start: number, end: number }
  }> = [];

  EXPRESSION_VARIABLES_EXTRACT.lastIndex = 0;
  while(true) {
    let startIndex = EXPRESSION_VARIABLES_EXTRACT.lastIndex;
    const result = EXPRESSION_VARIABLES_EXTRACT.exec(expressionStr);
    if (!result) break;

    // todo: deal repeat subscribeName
    const [reverseChainStrWithRoot, reverseChainStr] = result;
    const [, ...subscribeName] = reverseChainStr.split('.');

    complieResult.push({
      subscribeName: subscribeName.join('.'),
      subscribeParams: {
        expressStrPiece: reverseChainStrWithRoot,
        start: startIndex,
        end: startIndex + reverseChainStrWithRoot.length
      }
    })
  }

  return complieResult;
}

// @todo deal path, not only root.value.username
function getValueByChain(chain, dataPool) {
  let unserializeDataPool = {
    ...dataPool,
    'age.subAge': { value: 'test1', test2: 'test2' }
  };

  Object.keys(unserializeDataPool).forEach((path) => {
    if (path.split('.').length > 1) {
      const pathArr = path.split('.');
      let pathTemp = unserializeDataPool;

      for( let j = 0; j < pathArr.length; j += 1) {
        pathTemp[pathArr[j]] = {
          ...pathTemp[pathArr[j]],
          ...(j === pathArr.length - 1 ? unserializeDataPool[path] : {})
        }
        pathTemp = pathTemp[pathArr[j]];
      }
    }
  })

  let temp = unserializeDataPool[chain[0]];
  for (let i = 1; i < chain.length; i += 1) {
    if (undefined === temp) {
      return undefined;
    }
    temp = temp[chain[i]];
  }

  return temp;
}


// @todo 如果布局信息，仍然被聚合在 schema 中，path 需要过滤 布局组件
/**
 * @description schemaObj > Array<dynamicName, dynamicProps>
 */
function getDynamicElements(schemaObj) {
  function _deepRecursion(parentPath, properties) {
    let result = [];
    Object.keys(properties).forEach((id) => {
      const path = parentPath ? `${parentPath}.${id}` : id
      const {'x-component-props': xComponentProps, properties: subProperties, ...restProps} = properties[id];
      let dynamicProps = xComponentProps;

      // @todo check: is allow expression setted outside "x-component-props"
      Object.keys(restProps).forEach((propName) => {
        if (typeof propName === 'string' && IS_EXPRESSION_EXTRACT.test(restProps[propName])) {
          dynamicProps = {
            ...dynamicProps,
            [propName]: restProps[propName]
          }
        }
      })

      if (!isEmpty(dynamicProps)) {
        result.push({
          dynamicName: path,
          dynamicProps
        });
      }

      if (subProperties) {
        result = result.concat(_deepRecursion(path, subProperties));
      }
    })

    return result;
  }
  return _deepRecursion('', schemaObj.properties);
}

/**
 * @description [username, email] => return Promise<{username: {}, email: {}}>
 */
const getAllSubscribedState = (getFieldState, subscribeNames) => {
  const _timeout = {};
  const promises = subscribeNames.map((subscribeName) => {
    return new Promise((resolve) => {
      getFieldState(subscribeName, (fieldState) => {
        clearTimeout(_timeout[subscribeName])
        resolve({
          [subscribeName]: fieldState
        });
      })
      // @todo 需要 getFieldState 提供，不存在回调
      _timeout[subscribeName] = setTimeout(() => {
        resolve({});
      })
    })
  });

  return Promise.all(promises).then((fieldStateMapPieces) => {
    let result = {};
    fieldStateMapPieces.forEach((fieldStateMapPiece) => {
      result = {
        ...result,
        ...fieldStateMapPiece
      }
    })
    return result
  }).catch((e) => {
    console.log('bigSubscribe', e)
  })
}

/**
 * @description schemaObj > Array<dynamicName, dynamicProps>
 * @description Array<dynamicName, dynamicProps> > effects body
 */
function genrateDynamicEffectsBody(schemaObj, $, { setFieldState, getFieldState }) {
  const dynamicElements = getDynamicElements(schemaObj);

  const subscribesConfig = dynamicElements.map(({dynamicName, dynamicProps}) => {
    return Object.keys(dynamicProps).map((propName) => {
      const [, expressionStr] = dynamicProps[propName].match(EXPRESSION_EXTRACT) || [];

      if (expressionStr) {
        const complieResult = precomplieExpression(expressionStr);
        return {
          subscribeNames: complieResult.map(({subscribeName}) => subscribeName),
          subscribeFunc: (fieldStateMap) => {
            // eg: root.value.username !== ""  >>transfer>>  4 !== ""
            const expressionStrPieces = complieResult.map(({subscribeParams: {expressStrPiece}}) => expressStrPiece.replace(/\./g, '\\.'));
            const replaceRegularExpress = new RegExp(`(${expressionStrPieces.join('|')})`, 'g');

            const executableExpression = expressionStr.replace(replaceRegularExpress, ($0, $1) => {
              const [, stateName, ...chain] = $1.split('.'); // chain without root
              const chainResult = getValueByChain(chain.concat(stateName), fieldStateMap);
              if (typeof chainResult === 'string') {
                return `\"${chainResult}\"`
              } else {
                return chainResult
              }
            });
            let expressionResult;
            try {
              console.log('executableExpression:', executableExpression)
              expressionResult = eval(executableExpression);
            } catch (e) {
              console.error('[useEffects error]', e)
            }
            setFieldState(dynamicName, state => {
              state[propName] = expressionResult
            });
          }
        }
      } else {
        // todo setFieldProps directly
      }
    }).filter(i => !!i);
  }).reduce((a, b) => a.concat(b), [])

  subscribesConfig.forEach(({subscribeNames, subscribeFunc}) => {
    subscribeNames.forEach((subscribeName) => {
      // subscribe: all variable in express
      $('onFieldValueChange', subscribeName).subscribe(() => {
        // get: all subscribed's fieldState
        getAllSubscribedState(getFieldState, subscribeNames).then(subscribeFunc)
      });
    })
  });
}

export const useEffects = (props) => {
  const {
    effects: staticEffects,
    schema,
  } = props
  const schemaObj = new Schema(schema)

  return {
    effects: ($, { setFieldState, getFieldState }) => {
      genrateDynamicEffectsBody(schemaObj, $, { setFieldState, getFieldState });
      staticEffects($, { setFieldState, getFieldState });
    }
  }
}
