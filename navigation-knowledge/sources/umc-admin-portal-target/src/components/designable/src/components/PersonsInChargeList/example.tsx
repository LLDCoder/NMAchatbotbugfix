
import React from 'react';
import { createForm } from '@formily/core';
import { FormProvider, Field } from '@formily/react';
import { Form, FormItem } from '@formily/antd';
import { PersonsInChargeListField } from './PersonsInChargeListField';

export const BasicExample = () => {
  const form = React.useMemo(() => createForm(), []);

  return (
    <FormProvider form={form}>
      <Form form={form} layout="vertical">
        <Field
          name="personsInCharge"
          component={[PersonsInChargeListField, {
            title: "Persons in Charge",
            addButtonLabel: "Add New",
          }]}
          decorator={[FormItem]}
        />
      </Form>
    </FormProvider>
  );
};


export const LimitedExample = () => {
  const form = React.useMemo(() => createForm(), []);

  return (
    <FormProvider form={form}>
      <Form form={form} layout="vertical">
        <Field
          name="teamMembers"
          component={[PersonsInChargeListField, {
            title: "Project Team Members",
            addButtonLabel: "Add Team Member",
            maxMembers: 5, // 5
            showEmiratesId: true,
            showUID: false,
            showPassport: false,
          }]}
          decorator={[FormItem]}
        />
      </Form>
    </FormProvider>
  );
};

//  3: 
export const AllMethodsExample = () => {
  const form = React.useMemo(() => createForm(), []);

  return (
    <FormProvider form={form}>
      <Form form={form} layout="vertical">
        <Field
          name="authorizedPersons"
          component={[PersonsInChargeListField, {
            title: "Authorized Persons",
            addButtonLabel: "Add Person",
            maxMembers: 10,
            showEmiratesId: true,
            showUID: true,
            showPassport: true,
          }]}
          decorator={[FormItem]}
        />
      </Form>
    </FormProvider>
  );
};

//  4:  Schema 
export const SchemaExample = () => {
  const form = React.useMemo(() => 
    createForm({
      values: {
        personsInCharge: []
      }
    }), 
  []);

  const schema = {
    type: 'object',
    properties: {
      personsInCharge: {
        type: 'array',
        title: 'Persons in Charge',
        'x-decorator': 'FormItem',
        'x-component': 'PersonsInChargeList',
        'x-component-props': {
          title: 'Persons in Charge',
          addButtonLabel: 'Add New',
          maxMembers: 50,
          showEmiratesId: true,
          showUID: false,
          showPassport: false,
        }
      }
    }
  };

  // ： SchemaField  schema
  // import { createSchemaField } from '@formily/react';
  // const SchemaField = createSchemaField({ components: { PersonsInChargeList } });
  
  return (
    <FormProvider form={form}>
      <Form form={form} layout="vertical">
        {/* <SchemaField schema={schema} /> */}
        <Field
          name="personsInCharge"
          component={[PersonsInChargeListField, {
            title: "Persons in Charge",
            addButtonLabel: "Add New",
            maxMembers: 50,
            showEmiratesId: true,
            showUID: false,
            showPassport: false,
          }]}
          decorator={[FormItem]}
        />
      </Form>
    </FormProvider>
  );
};

