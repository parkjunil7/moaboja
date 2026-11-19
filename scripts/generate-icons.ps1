# SVG와 같은 도형으로 PNG를 생성합니다. 생성된 PNG를 Git에 포함하므로 빌드 시 Windows는 필요하지 않습니다.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../public/icons'
[IO.Directory]::CreateDirectory($iconRoot) | Out-Null
function Brush([string]$hex) { [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($hex)) }
function RoundedPath([single]$x,[single]$y,[single]$w,[single]$h,[single]$r) {
  $p = [Drawing.Drawing2D.GraphicsPath]::new()
  $d = 2*$r
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc(($x+$w-$d),$y,$d,$d,270,90)
  $p.AddArc(($x+$w-$d),($y+$h-$d),$d,$d,0,90)
  $p.AddArc($x,($y+$h-$d),$d,$d,90,90)
  $p.CloseFigure()
  return $p
}
$master = [Drawing.Bitmap]::new(1024,1024)
$g = [Drawing.Graphics]::FromImage($master)
$g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.ScaleTransform(2,2)
$g.Clear([Drawing.ColorTranslator]::FromHtml('#234e43'))
$sage=Brush '#b9d1a3'; $pale=Brush '#e5edc9'; $cream=Brush '#f8f7ed'; $heartBrush=Brush '#73977f'; $green=Brush '#234e43'
$g.FillEllipse($sage,139,104,120,120)
$pen=[Drawing.Pen]::new($green,12);$pen.StartCap=$pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($pen,199,138,199,190)
$g.FillEllipse($pale,232,87,132,132)
$g.DrawLine($pen,298,124,298,182)
$wallet=RoundedPath 104 213 304 198 43;$g.FillPath($cream,$wallet)
$lipBrush=Brush '#d6e1c5';$lip=[Drawing.Pen]::new($lipBrush,12);$lip.StartCap=$lip.EndCap=[Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($lip,147,213,365,213)
$heart=[Drawing.Drawing2D.GraphicsPath]::new()
$heart.AddBezier(239,357,225,345,188,320,188,295)
$heart.AddBezier(188,295,188,269,220,260,239,282)
$heart.AddBezier(239,282,258,260,290,269,290,295)
$heart.AddBezier(290,295,290,320,253,345,239,357)
$heart.CloseFigure();$g.FillPath($heartBrush,$heart)
$clasp=RoundedPath 337 275 80 68 22;$g.FillPath($sage,$clasp);$g.FillEllipse($green,360,300,18,18)
$g.Dispose()
foreach($size in @(32,180,192,512)) {
  $icon=[Drawing.Bitmap]::new($size,$size)
  $graphics=[Drawing.Graphics]::FromImage($icon)
  $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#234e43'))
  $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($master,[Drawing.Rectangle]::new(0,0,$size,$size))
  $icon.Save((Join-Path $iconRoot "moaboja-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose();$icon.Dispose()
}
$master.Dispose();$sage.Dispose();$pale.Dispose();$cream.Dispose();$heartBrush.Dispose();$green.Dispose();$lipBrush.Dispose();$pen.Dispose();$lip.Dispose();$wallet.Dispose();$heart.Dispose();$clasp.Dispose()
Write-Output '모아보자 아이콘 32/180/192/512px 생성 완료'
