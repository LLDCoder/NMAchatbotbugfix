import { useEffect } from 'react';
import { connect, useForm } from '@formily/react';
import { Card } from 'antd';
import { useTranslation } from "react-i18next";

const api = {
  loadEmirates: async () => [
    { label: 'Abu Dhabi', value: 'Abu Dhabi' },
    { label: 'Dubai', value: 'Dubai' },
    { label: 'Sharjah', value: 'Sharjah' },
    { label: 'Ajman', value: 'Ajman' },
    { label: 'Umm Al Quwain', value: 'Umm Al Quwain' },
    { label: 'Ras Al Khaimah', value: 'Ras Al Khaimah' },
    { label: 'Fujairah', value: 'Fujairah' }
  ],

  loadRegions: async (emirate) => {
    if (emirate !== 'Abu Dhabi') return [];
    return [
      { label: "Abu Dhabi Island", value: "Abu Dhabi Island" },
      { label: "Al Khalidiyah", value: "Al Khalidiyah" },
      { label: "Al Bateen", value: "Al Bateen" },
      { label: "Corniche Area", value: "Corniche Area" },
      { label: "Electra Street / Tourist Club Area (TCA)", value: "Electra Street / Tourist Club Area (TCA)" },
      { label: "Al Zahiyah", value: "Al Zahiyah" },
      { label: "Madinat Zayed", value: "Madinat Zayed" },
      { label: "Al Markaziyah", value: "Al Markaziyah" }
    ];
  },

  loadAreas: async (region) => [
    { label: region + ' - Area 1', value: region + '-area1' },
    { label: region + ' - Area 2', value: region + '-area2' }
  ]
};

const CustomizeAddress = connect((props) => {
  const { t } = useTranslation();
  const form = useForm();

  useEffect(() => {
    // initial emirate dropdown list
    const emirateField = form.query('*.emirate').take();
    if (emirateField) {
      (async () => {
        emirateField.setLoading(true);
        emirateField.dataSource = await api.loadEmirates();
        emirateField.setLoading(false);
      })();
    }

    // subscribe to all form changes
    const unsubscribe = form.subscribe(async (event) => {
      // Formily will trigger many events, we only care about value changes
      if (event.type !== 'onFieldInputValueChange') return;

      const field = event.payload;
      const path = field.path.toString();
      const value = field.value;

      // when emirate changes
      if (path.endsWith('emirate')) {
        const regionField = form.query('*.region').take();
        const areaField   = form.query('*.area').take();
        if (!regionField || !areaField) return;

        regionField.setValue(undefined);
        

        if (value === 'Abu Dhabi') {
          regionField.setState(s => { s.visible = true; s.display = 'visible'; s.required = true; });
          regionField.setLoading(true);
          regionField.dataSource = await api.loadRegions(value);
          regionField.setLoading(false);
        } else {
          regionField.setState(s => {
            s.visible = false; s.display = 'none'; s.required = false; s.value = undefined;
          });
          areaField.setState(s => {
            s.visible = false; s.display = 'none'; s.required = false; s.value = undefined; s.dataSource = [];
          });
        }
      }

      // when region changes
      if (path.endsWith('region')) {
        const areaField = form.query('*.area').take();
        if (!areaField) return;

        areaField.setValue(undefined);

        if (value) {
          areaField.setState(s => { s.visible = true; s.display = 'visible'; s.required = true; });
          areaField.setLoading(true);
          areaField.dataSource = await api.loadAreas(value);
          areaField.setLoading(false);
        } else {
          areaField.setState(s => { s.visible = false; s.display = 'none'; s.required = false; s.value = undefined; });
        }
      }
    });

  }, []);

  return (
    <Card {...props} title={t("Formily.CustomizeAddress.cardTitle")}>
      {props.children}
    </Card>
  );
});

export default CustomizeAddress;
