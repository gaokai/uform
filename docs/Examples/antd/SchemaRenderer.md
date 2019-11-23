# Schema 生成表单

> 通过标准 schema 生成表单

### Demo 示例

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
// import {
//   FormButtonGroup,
// } from '@uform/antd'
import {
  registerFormComponent,
  registerFormItemComponent,
  registerFormField,
  SchemaForm,
  createFormActions,
  connect
} from '@uform/react-schema-renderer'
import { filter, withLatestFrom, map, debounceTime } from 'rxjs/operators'
import { Form, Button, Input, InputNumber } from 'antd'
import Printer from '@uform/printer'
import 'antd/dist/antd.css'

// 为去除 antd 依赖
registerFormComponent((props) => {
  // console.log('antd form props', props);
  return (
    <Form
      {...props}
    />
  );
})
// 为去除 antd 依赖
registerFormItemComponent((props) => {
  // console.log('itemProps', props);
  return (
    <Form.Item
      label={props.props.title}
    >
      {props.children}
    </Form.Item>
  );
})
// 为去除 antd 依赖
registerFormField(
  'string',
  connect()(Input)
)

const actions = createFormActions()

const schema = {
  "type": "object",
  "description": "Basic Form",
  "x-props": {
    "inline": true
  },
  "properties": {
    "username": {
      "title": "username",
      "type": "string"
    },
    "age": {
      "title": "age",
      "type": "string",
      "x-component": "inputnumber",
      "x-component-props": {
        "hide": "{{root.value.username !== \"\" && root.value.password}}"
      },
      // "properties": {
      //   "subAge": {
      //     "title": "subAge",
      //     "type": "string",
      //     "x-component-props": {
      //       "hide": "{{root.value.username !== \"\"}}"
      //     }
      //   }
      // },
    },
    "password": {
      "title": "password",
      "type": "string",
      "x-component": "input",
      "x-component-props": {
        "placeholder": "Please Enter Password"
      },
      "x-rules": [{"required": true}]
    },
    // "Submit": {
    //   "title": "Submit",
    //   "type": "string",
    //   "description": "",
    //   "x-component": "Button",
    //   "x-component-props": {
    //     "text": "Submit",
    //     "htmlType": "submit"
    //   }
    // }
  }
}

function customFieldConnect(customField) {
  return connect({
    // getProps: mapStyledProps,
    // getComponent: mapTextComponent
  })(customField)
}

const App = () => (
  <Printer>
    <SchemaForm
      schema={schema}
      actions={actions}
      labelCol={{
        span: 3
      }}
      layout="vertical"
      wrapperCol={{
        span: 4
      }}
      fields={{
        input: customFieldConnect((props) => {
          // console.log('input props', props)
          return <Input {...props} />
        }),
        inputnumber: customFieldConnect((props) => {
          // console.log('inputNumber props', props)
          return <InputNumber {...props} />
        })
      }}
      onSubmit={v => alert(JSON.stringify(v))}
      effects={($, { setFieldState, getFieldState }) => {
        // $('onFormInit').subscribe(() => {
        //   // hide(FormPath.match('aa.*.*(cc,gg,dd.*.ee)'))
        //   // console.log('onFormInit');
        // })
        // $('onFieldValueChange', 'password').subscribe(fieldState => {
        //   console.log('fieldState password', fieldState)
        // })
        // $('onFieldValueChange', 'username').subscribe(fieldState => {
        //   console.log('fieldState username', fieldState)
        // })
      }}
    >
        <Button
          onClick={() => {
            //异步调用没问题
            actions.setFieldState('aa', state => {
              state.value = 'hello world'
            })
            actions.submit()
          }}
        >
          修改AA的值并提交表单
        </Button>
    </SchemaForm>
  </Printer>
)

ReactDOM.render(<App />, document.getElementById('root'))
```
