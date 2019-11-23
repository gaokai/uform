import React, { Fragment } from 'react'
import {
  registerFormField,
  connect,
  SchemaMarkupForm as SchemaForm,
  SchemaMarkupField as Field,
  createFormActions,
  // createVirtualBox,
  registerFieldMiddleware
} from '../index'
// import { toArr } from '@uform/shared'
import { render, wait, fireEvent } from '@testing-library/react'
// import { filter } from 'rxjs/operators'

registerFieldMiddleware(Field => {
  return props => {
    return (
      <div>
        {props.schema.title}
        <Field {...props} />
        {props.errors && props.errors.length ? (
          <div data-testid={'test-errors'}>{props.errors}</div>
        ) : (
          ''
        )}
      </div>
    )
  }
})
registerFormField(
  'string',
  connect()(props => props.disabled
    ? <span>Disabled</span>
    : <input {...props} value={props.value || ''} />)
)

test('onFormInit setFieldState', async () => {
  const actions = createFormActions()
  const TestComponent = () => (
    <SchemaForm
      actions={actions}
      effects={($, { setFieldState }) => {
        $('onFormInit').subscribe(() => {
          setFieldState('aaa', state => {
            state.props.title = 'text1'
            state.rules = [
              {
                required: true,
              }
            ]
          })
        })
      }}
    >
      <Fragment>
        <Field name="aaa" type="string" />
        <button type="submit" data-testid="btn">
          Submit
        </button>
      </Fragment>
    </SchemaForm>
  )

  const { getByText, getByTestId, queryByText } = render(<TestComponent />)

  await wait();
  expect(queryByText('text1')).toBeVisible()
  await wait();
  fireEvent.click(getByTestId('btn'))
  await wait();
  expect(getByText('This field is required')).toBeVisible()
  await wait();
  actions.setFieldState('aaa', state => {
    state.rules = []
  })
  await wait();
  fireEvent.click(getByTestId('btn'))
  await wait();
  expect(queryByText('This field is required')).toBeNull()
})
