
interface LeftSideSvgProps {
    color?: string
}

export default function LeftSideSvg(props: LeftSideSvgProps) { 
    return <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.5925 14.1167C11.0611 13.6481 10.9349 12.762 10.3103 12.1372L6.17358 8.00049L10.3103 3.86279C10.935 3.23797 11.0611 2.35188 10.5925 1.8833C10.124 1.41473 9.23786 1.54088 8.61304 2.16553L4.08765 6.69092C3.73605 7.04251 3.54201 7.47733 3.52319 7.87353L3.52319 8.12646C3.54203 8.52258 3.73618 8.95657 4.08765 9.30811L8.61304 13.8345C9.23783 14.4591 10.1239 14.5852 10.5925 14.1167Z" fill={props.color ?? '#fff'}/>
    </svg>

}