# demo

```js
  <FormPanel
          mode={"view"}
          form={form}
          record={{
            dateOfBirth: "2025-01-01",
            passportNumber: 123123,
          }}
          onValuesChange={handleFormValuesChange}
          sections={[
            {
              key: "establishmentInfo",
              title: "Establishment Information",
              columns: 3,
              items: [
                {
                  key: "dateOfBirth",
                  label: "dateOfBirth",
                  renderEdit: (form) => (
                    <Form.Item name="dateOfBirth" label="dateOfBirth">
                      <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                  ),
                },
                {
                  key: "personalEmail",
                  label: "personalEmail",
                  renderEdit: (form) => (
                    <Form.Item
                      name="personalEmail"
                      label="Email"
                      rules={[
                        { required: true, message: "Please enter email" },
                        { type: "email", message: "Please enter valid email" },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  ),
                },
                {
                  key: "passportNumber",
                  label: "passportNumber",
                  renderEdit: (form) => (
                    <Form.Item name="passportNumber" label="Passport Number">
                      <Input />
                    </Form.Item>
                  ),
                },
              ],
            },
            {
              key: "establishmentDocuments",
              title: "Establishment Documents",
              columns: 3,
              items: [
                {
                  key: "commercialLicenseUrl",
                  colSpan: 1,
                  renderEdit: () => (
                    <Form.Item
                      name="commercialLicenseUrl"
                      label="Upload Commercial License"
                      rules={[
                        {
                          required: true,
                          message: "Please upload commercial license",
                        },
                      ]}
                    >
                      <DocumentViewer
                        key={
                          fetchedCommercialData?.documents?.commercialLicense ||
                          "empty"
                        }
                        hasDelete
                        uploadConfig={{
                          maxCount: 1,
                          maxSize: 5,
                          uploadTip:
                            "Maximum size: 5MB. File types: jpg, jpeg, and png.",
                        }}
                        fileName={
                          fetchedCommercialData?.documents?.commercialLicense
                        }
                      />
                    </Form.Item>
                  ),
                },
              ],
            },
            {
              key: "legalPersonInfo",
              title: "Legal Person Information",
              columns: 3,
              items: [
                {
                  key: "legalPersonName",
                  colSpan: 1,
                  renderEdit: () => (
                    <Form.Item
                      name="legalPersonName"
                      label="Legal Person"
                      rules={[
                        {
                          required: true,
                          message: "Please enter legal person name",
                        },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  ),
                },
                
              ],
            },
          ]}
        />

```
