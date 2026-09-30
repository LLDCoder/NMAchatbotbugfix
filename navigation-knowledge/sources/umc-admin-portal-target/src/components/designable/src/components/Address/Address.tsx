import { useFieldSchema, RecursionField, observer, useField } from "@formily/react";
import { useTranslation } from "react-i18next";


export const Address = observer((props) => {
  const { t } = useTranslation();
  const field = useField();
  const fieldSchema = useFieldSchema();
  console.log("fieldSchema--------->", fieldSchema, props);
  console.log("field--------->", field);
  
  if (!fieldSchema) {
    return <div className="address-container">{t("Formily.Address.noSchema")}</div>;
  }
  
  return (
    <div className="address-container">
      {fieldSchema.mapProperties((propertySchema, key) => {
        return (
          <div key={key}>
            <RecursionField name={key} schema={propertySchema} />
          </div>
        );
      })}
    </div>
  );
})

export default Address
