import React, { useState } from 'react';
import { Form, Button, Card } from 'antd';
import AddressSelector, { AddressSelectorValue } from './index';

const AddressSelectorExample: React.FC = () => {
  const [form] = Form.useForm();
  const [address, setAddress] = useState<AddressSelectorValue>({});

  const handleSubmit = () => {
    console.log('Selected Address:', address);
    console.log('Form Values:', form.getFieldsValue());
  };

  const handleReset = () => {
    setAddress({});
    form.resetFields();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <Card title="AddressSelector Example">
        
        {/* Standalone Usage */}
        <div style={{ marginBottom: '32px' }}>
          <h3>Standalone Usage</h3>
          <AddressSelector
            value={address}
            onChange={setAddress}
            layout="horizontal"
          />
          <div style={{ marginTop: '16px' }}>
            <strong>Selected:</strong> {JSON.stringify(address, null, 2)}
          </div>
        </div>

        {/* Vertical Layout */}
        <div style={{ marginBottom: '32px' }}>
          <h3>Vertical Layout</h3>
          <AddressSelector
            value={address}
            onChange={setAddress}
            layout="vertical"
            placeholder={{
              emirate: "Choose your Emirate",
              region: "Choose your Region",
              area: "Choose your Area"
            }}
          />
        </div>

        {/* Form Integration */}
        <div style={{ marginBottom: '32px' }}>
          <h3>Form Integration</h3>
          <Form form={form} layout="vertical">
            <Form.Item
              name="address"
              label="Address Information"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || !value.emirate || !value.region || !value.area) {
                      return Promise.reject('Please select complete address');
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <AddressSelector />
            </Form.Item>
            
            <Form.Item name="street" label="Street Address">
              <input placeholder="Enter street address" style={{ width: '100%', padding: '8px' }} />
            </Form.Item>
          </Form>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button type="primary" onClick={handleSubmit}>
            Submit
          </Button>
          <Button onClick={handleReset}>
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AddressSelectorExample;