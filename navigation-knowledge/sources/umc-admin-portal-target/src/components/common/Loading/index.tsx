import { ReloadOutlined } from '@ant-design/icons'
import { t } from 'i18next';
import './index.less';
interface ILoadingProps {
    loading: boolean
}

export default function Loading({ loading, children }: React.PropsWithChildren<ILoadingProps>) {
    return loading ? <div className="loading-wrapper"><span className='loading-icon'><ReloadOutlined /></span><span className='loading-text'>{t('common.loading')}</span></div> : <>{children}</>
}