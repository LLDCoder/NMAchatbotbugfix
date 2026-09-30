
interface RightSideSvgProps {
    color?: string
}

export default function RightSideSvg(props: RightSideSvgProps) {
    return <svg width="1em" height="1em" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.60742 14.1167C5.13885 13.6481 5.26501 12.762 5.88965 12.1372L10.0264 8.00049L5.88965 3.86279C5.265 3.23797 5.13886 2.35188 5.60742 1.8833C6.076 1.41473 6.96209 1.54088 7.58691 2.16553L12.1123 6.69092C12.4639 7.04251 12.6579 7.47733 12.6768 7.87353L12.6768 8.12646C12.6579 8.52258 12.4638 8.95657 12.1123 9.30811L7.58691 13.8345C6.96212 14.4591 6.07601 14.5852 5.60742 14.1167Z" fill={props.color??'#fff'}/>
    </svg>
}
    